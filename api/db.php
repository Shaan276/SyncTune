<?php
// SyncTune Database Helper File
// Handles PDO database connection, automatic table creation, and admin seeding.

require_once 'config.php';

class DB {
    private static $pdo = null;

    public static function connect() {
        if (self::$pdo !== null) {
            return self::$pdo;
        }

        try {
            // 1. Connect first without database to ensure the database exists (only on localhost)
            if (defined('DB_HOST') && (DB_HOST === 'localhost' || DB_HOST === '127.0.0.1')) {
                try {
                    $dsnNoDb = "mysql:host=" . DB_HOST . ";port=3306;charset=utf8mb4";
                    $pdoNoDb = new PDO($dsnNoDb, DB_USER, DB_PASS, [
                        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
                    ]);
                    $pdoNoDb->exec("CREATE DATABASE IF NOT EXISTS " . DB_NAME . " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
                    $pdoNoDb = null; // Close connection
                } catch (PDOException $e) {
                    // Ignore and proceed
                }
            }

            // 2. Connect with database name
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";port=3306;charset=utf8mb4";
            self::$pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_PERSISTENT => false
            ]);

            // 3. Auto initialize database tables
            self::initSchema();

            return self::$pdo;
        } catch (PDOException $e) {
            sendError("Database connection failed: " . $e->getMessage(), 500);
        }
    }

    private static function initSchema() {
        $db = self::$pdo;

        // Users Table
        $db->exec("CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            username VARCHAR(100) NOT NULL,
            role VARCHAR(50) DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;");

        // Songs Table (Cache of searched songs)
        $db->exec("CREATE TABLE IF NOT EXISTS songs (
            id VARCHAR(50) PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            artist VARCHAR(255) NOT NULL,
            duration INT NOT NULL,
            thumbnail VARCHAR(512) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;");

        // Data Usage Table
        $db->exec("CREATE TABLE IF NOT EXISTS data_usage (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            bytes BIGINT NOT NULL DEFAULT 0,
            recorded_date DATE NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_user_date (user_id, recorded_date)
        ) ENGINE=InnoDB;");

        // Listens Table (History)
        $db->exec("CREATE TABLE IF NOT EXISTS listens (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            song_id VARCHAR(50) NOT NULL,
            listened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
        ) ENGINE=InnoDB;");

        // Rooms Table
        $db->exec("CREATE TABLE IF NOT EXISTS rooms (
            code VARCHAR(10) PRIMARY KEY,
            host_id INT NOT NULL,
            song_id VARCHAR(50) DEFAULT NULL,
            song_title VARCHAR(255) DEFAULT NULL,
            song_artist VARCHAR(255) DEFAULT NULL,
            song_thumbnail VARCHAR(512) DEFAULT NULL,
            song_duration INT DEFAULT NULL,
            is_playing TINYINT DEFAULT 0,
            `current_time` FLOAT DEFAULT 0,
            last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            anyone_can_play TINYINT DEFAULT 1,
            allow_listener_control TINYINT DEFAULT 1,
            action_id INT DEFAULT 0,
            last_updated_by INT DEFAULT NULL,
            is_cinema TINYINT DEFAULT 0,
            FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB;");

        // Room Members Table
        $db->exec("CREATE TABLE IF NOT EXISTS room_members (
            id INT AUTO_INCREMENT PRIMARY KEY,
            room_code VARCHAR(10) NOT NULL,
            user_id INT NOT NULL,
            last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (room_code) REFERENCES rooms(code) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_room_user (room_code, user_id)
        ) ENGINE=InnoDB;");

        // Room Chats Table
        $db->exec("CREATE TABLE IF NOT EXISTS room_chats (
            id INT AUTO_INCREMENT PRIMARY KEY,
            room_code VARCHAR(10) NOT NULL,
            user_id INT NOT NULL,
            message VARCHAR(512) NOT NULL,
            sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (room_code) REFERENCES rooms(code) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB;");

        // Room Recommendations Table
        $db->exec("CREATE TABLE IF NOT EXISTS room_recommendations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            room_code VARCHAR(10) NOT NULL,
            video_id VARCHAR(20) NOT NULL,
            recommended_json TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX (room_code),
            INDEX (video_id)
        ) ENGINE=InnoDB;");

         // Friends Table
         $db->exec("CREATE TABLE IF NOT EXISTS friends (
             id INT AUTO_INCREMENT PRIMARY KEY,
             user_id INT NOT NULL,
             friend_user_id INT NOT NULL,
             status ENUM('pending','accepted','rejected') DEFAULT 'pending',
             created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
             FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
             FOREIGN KEY (friend_user_id) REFERENCES users(id) ON DELETE CASCADE,
             UNIQUE KEY unique_friendship (user_id, friend_user_id)
         ) ENGINE=InnoDB;");

         // Room Invitations Table
         $db->exec("CREATE TABLE IF NOT EXISTS room_invitations (
             id INT AUTO_INCREMENT PRIMARY KEY,
             room_code VARCHAR(10) NOT NULL,
             inviter_id INT NOT NULL,
             invitee_id INT NOT NULL,
             status VARCHAR(20) DEFAULT 'pending',
             created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
             UNIQUE KEY unique_invite (room_code, inviter_id, invitee_id)
         ) ENGINE=InnoDB;");

         // Try adding foreign keys safely without crashing if the server environment has strict collation/signed mismatches
         try {
             $db->exec("ALTER TABLE room_invitations ADD CONSTRAINT fk_room_inv_code FOREIGN KEY (room_code) REFERENCES rooms(code) ON DELETE CASCADE");
         } catch (PDOException $e) {}
         try {
             $db->exec("ALTER TABLE room_invitations ADD CONSTRAINT fk_room_inv_inviter FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE");
         } catch (PDOException $e) {}
         try {
             $db->exec("ALTER TABLE room_invitations ADD CONSTRAINT fk_room_inv_invitee FOREIGN KEY (invitee_id) REFERENCES users(id) ON DELETE CASCADE");
         } catch (PDOException $e) {}

         // Run migrations safely
        try {
            $db->exec("ALTER TABLE users ADD COLUMN status VARCHAR(50) DEFAULT 'active'");
        } catch (PDOException $e) {}
        try {
            $db->exec("ALTER TABLE users ADD COLUMN status_override VARCHAR(50) DEFAULT NULL");
        } catch (PDOException $e) {}
        try {
            $db->exec("ALTER TABLE users ADD COLUMN last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        } catch (PDOException $e) {}
        try {
            $db->exec("ALTER TABLE room_members ADD COLUMN is_hidden TINYINT DEFAULT 0");
        } catch (PDOException $e) {}
        try {
            $db->exec("ALTER TABLE rooms ADD COLUMN anyone_can_play TINYINT DEFAULT 1");
        } catch (PDOException $e) {}
        try {
            $db->exec("ALTER TABLE rooms MODIFY COLUMN last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
        } catch (PDOException $e) {}
        try {
            $db->exec("ALTER TABLE rooms ADD COLUMN action_id INT DEFAULT 0");
        } catch (PDOException $e) {}
        try {
            $db->exec("ALTER TABLE rooms ADD COLUMN last_updated_by INT DEFAULT NULL");
        } catch (PDOException $e) {}
        try {
            $db->exec("ALTER TABLE rooms ADD COLUMN allow_listener_control TINYINT DEFAULT 1");
        } catch (PDOException $e) {}
        try {
            $db->exec("ALTER TABLE rooms ADD COLUMN is_cinema TINYINT DEFAULT 0");
        } catch (PDOException $e) {}
        try {
            $db->exec("CREATE INDEX idx_users_last_seen ON users(last_seen_at)");
        } catch (PDOException $e) {}
        try {
            $db->exec("CREATE INDEX idx_room_members_seen ON room_members(last_seen_at)");
        } catch (PDOException $e) {}
        try {
            $db->exec("CREATE INDEX idx_friends_status ON friends(status)");
        } catch (PDOException $e) {}
        try {
            $db->exec("CREATE INDEX idx_room_inv_status ON room_invitations(status)");
        } catch (PDOException $e) {}

        // Seed Admin User
        self::seedAdmin();
        
        // Seed Default Popular Songs for Search and Recommendations Fallback
        self::seedDefaultSongs();
    }

    private static function seedAdmin() {
        $db = self::$pdo;
        $adminEmail = 'piyushpilkhwal74@gmail.com';
        $adminPass = 'Shaan@abl15v5uuu';
        $adminName = 'Piyush Pilkhwal';

        $stmt = $db->prepare("SELECT id, role FROM users WHERE email = ?");
        $stmt->execute([$adminEmail]);
        $user = $stmt->fetch();

        if (!$user) {
            $hashedPass = password_hash($adminPass, PASSWORD_BCRYPT);
            $insert = $db->prepare("INSERT INTO users (email, password, username, role) VALUES (?, ?, ?, 'admin')");
            $insert->execute([$adminEmail, $hashedPass, $adminName]);
        } else if ($user['role'] !== 'admin') {
            $update = $db->prepare("UPDATE users SET role = 'admin' WHERE id = ?");
            $update->execute([$user['id']]);
        }
    }

    private static function seedDefaultSongs() {
        $db = self::$pdo;
        
        $songs = [
            ['4NRXx6U8ABQ', 'Blinding Lights', 'The Weeknd', 200, 'https://img.youtube.com/vi/4NRXx6U8ABQ/0.jpg'],
            ['JGwWNGJdvx8', 'Shape of You', 'Ed Sheeran', 233, 'https://img.youtube.com/vi/JGwWNGJdvx8/0.jpg'],
            ['7wtfhZwyrcc', 'Believer', 'Imagine Dragons', 204, 'https://img.youtube.com/vi/7wtfhZwyrcc/0.jpg'],
            ['2Vv-BfVoq4g', 'Perfect', 'Ed Sheeran', 279, 'https://img.youtube.com/vi/2Vv-BfVoq4g/0.jpg'],
            ['34Na4j8AVgA', 'Starboy', 'The Weeknd ft. Daft Punk', 230, 'https://img.youtube.com/vi/34Na4j8AVgA/0.jpg'],
            ['0yW7w8F2TVA', "Say You Won't Let Go", 'James Arthur', 211, 'https://img.youtube.com/vi/0yW7w8F2TVA/0.jpg'],
            ['PT2_F-1esPk', 'Closer', 'The Chainsmokers ft. Halsey', 247, 'https://img.youtube.com/vi/PT2_F-1esPk/0.jpg'],
            ['euCqAq60qPE', 'Let Me Love You', 'DJ Snake ft. Justin Bieber', 205, 'https://img.youtube.com/vi/euCqAq60qPE/0.jpg'],
            ['FM7MFYuyoHs', 'Something Just Like This', 'The Chainsmokers & Coldplay', 247, 'https://img.youtube.com/vi/FM7MFYuyoHs/0.jpg'],
            ['SlPhMPnQ58k', 'Memories', 'Maroon 5', 189, 'https://img.youtube.com/vi/SlPhMPnQ58k/0.jpg'],
            ['DyDfgMOUjCI', 'Bad Guy', 'Billie Eilish', 194, 'https://img.youtube.com/vi/DyDfgMOUjCI/0.jpg'],
            ['hT_nvWreIhg', 'Counting Stars', 'OneRepublic', 257, 'https://img.youtube.com/vi/hT_nvWreIhg/0.jpg'],
            ['IcrbM1l_BoI', 'Wake Me Up', 'Avicii', 249, 'https://img.youtube.com/vi/IcrbM1l_BoI/0.jpg'],
            ['kTJczUoc26U', 'Stay', 'The Kid LAROI & Justin Bieber', 141, 'https://img.youtube.com/vi/kTJczUoc26U/0.jpg'],
            ['H5v3kku4y6Q', 'As It Was', 'Harry Styles', 167, 'https://img.youtube.com/vi/H5v3kku4y6Q/0.jpg'],
            ['bo_efYhYU2A', 'Shallow', 'Lady Gaga & Bradley Cooper', 216, 'https://img.youtube.com/vi/bo_efYhYU2A/0.jpg'],
            ['zABLecsR5UE', 'Someone You Loved', 'Lewis Capaldi', 182, 'https://img.youtube.com/vi/zABLecsR5UE/0.jpg'],
            ['oygrmJFKYZY', "Don't Start Now", 'Dua Lipa', 183, 'https://img.youtube.com/vi/oygrmJFKYZY/0.jpg'],
            ['gdZLi9oWNZg', 'Dynamite', 'BTS', 199, 'https://img.youtube.com/vi/gdZLi9oWNZg/0.jpg'],
            ['q0hyYWLuEN0', 'Dance Monkey', 'Tones and I', 209, 'https://img.youtube.com/vi/q0hyYWLuEN0/0.jpg'],
            ['V1Pl8CzNzCw', 'Lovely', 'Billie Eilish & Khalid', 200, 'https://img.youtube.com/vi/V1Pl8CzNzCw/0.jpg'],
            ['G7KNmW9a75Y', 'Flowers', 'Miley Cyrus', 200, 'https://img.youtube.com/vi/G7KNmW9a75Y/0.jpg'],
            ['ic8j13gFLI8', 'Cruel Summer', 'Taylor Swift', 178, 'https://img.youtube.com/vi/ic8j13gFLI8/0.jpg'],
            ['S9bCLPwzSC0', 'Mockingbird', 'Eminem', 251, 'https://img.youtube.com/vi/S9bCLPwzSC0/0.jpg'],
            ['60ItHLz5WEA', 'Faded', 'Alan Walker', 212, 'https://img.youtube.com/vi/60ItHLz5WEA/0.jpg']
        ];
        
        $checkStmt = $db->prepare("SELECT id FROM songs WHERE id = ?");
        $insertStmt = $db->prepare("INSERT INTO songs (id, title, artist, duration, thumbnail) VALUES (?, ?, ?, ?, ?)");
        
        foreach ($songs as $s) {
            $checkStmt->execute([$s[0]]);
            if (!$checkStmt->fetch()) {
                $insertStmt->execute([$s[0], $s[1], $s[2], $s[3], $s[4]]);
            }
        }
    }
}
?>
