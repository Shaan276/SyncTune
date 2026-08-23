<?php
// SyncTune Common Configuration File
// Handles CORS headers, JWT authentication, and global helper functions.

// Enable CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE");
header("Content-Type: application/json; charset=UTF-8");

// Handle OPTIONS preflight requests
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Dynamic Environment Checking (Localhost XAMPP vs hosted InfinityFree server)
$httpHost = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost';
$serverAddr = isset($_SERVER['SERVER_ADDR']) ? $_SERVER['SERVER_ADDR'] : '127.0.0.1';

$isLocalhost = in_array($httpHost, ['localhost', '127.0.0.1', '[::1]']) || in_array($serverAddr, ['127.0.0.1', '::1']);

// Check if accessing via private network IP (e.g. 192.168.x.x, 10.x.x.x, 172.16.x.x-172.31.x.x)
if (!$isLocalhost) {
    $hostIp = explode(':', $httpHost)[0];
    if (filter_var($hostIp, FILTER_VALIDATE_IP)) {
        // FILTER_FLAG_NO_PRIV_RANGE returns false if it is a private IP, meaning it is local
        $isPrivate = filter_var($hostIp, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false;
        if ($isPrivate) {
            $isLocalhost = true;
        }
    }
}

if ($isLocalhost) {
    define('DB_HOST', 'localhost');
    define('DB_USER', 'root');
    define('DB_PASS', '');
    define('DB_NAME', 'synctune_db');
} else {
    // Hosted Server Credentials (InfinityFree)
    define('DB_HOST', 'sql105.infinityfree.com');
    define('DB_USER', 'if0_42235449');
    define('DB_PASS', 'rN00cQcYmgI');
    define('DB_NAME', 'if0_42235449_xx');
}

// YouTube Data API v3 Key Configuration
define('YOUTUBE_API_KEY', '');

// Google OAuth Client ID (set this ONCE — users will see a seamless Google sign-in)
// Get yours free at: https://console.cloud.google.com → APIs & Services → Credentials → Create OAuth Client ID
// Set type to "Web application" and add your redirect URI (e.g. http://localhost/SyncTune/google_link.html)
define('GOOGLE_CLIENT_ID', '953507119047-j01u4a1801v04r28k14j1c070g7j00a9.apps.googleusercontent.com');

// JWT Configuration
define('JWT_SECRET', 'synctune_super_secret_key_12345_67890');

// Base64URL Helper functions
function base64UrlEncode($data) {
    return str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($data));
}

function base64UrlDecode($data) {
    $remainder = strlen($data) % 4;
    if ($remainder) {
        $padlen = 4 - $remainder;
        $data .= str_repeat('=', $padlen);
    }
    return base64_decode(str_replace(['-', '_'], ['+', '/'], $data));
}

// JWT Encoding Helper
function encodeJWT($payload, $expiryDays = 7) {
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    
    $payload['iat'] = time();
    $payload['exp'] = time() + ($expiryDays * 24 * 60 * 60);
    
    $base64UrlHeader = base64UrlEncode($header);
    $base64UrlPayload = base64UrlEncode(json_encode($payload));
    
    $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, JWT_SECRET, true);
    $base64UrlSignature = base64UrlEncode($signature);
    
    return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
}

// JWT Decoding Helper
function decodeJWT($token) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }
    
    list($base64UrlHeader, $base64UrlPayload, $base64UrlSignature) = $parts;
    
    $signature = base64UrlEncode(hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, JWT_SECRET, true));
    
    if (!hash_equals($signature, $base64UrlSignature)) {
        return null;
    }
    
    $payload = json_decode(base64UrlDecode($base64UrlPayload), true);
    
    if (isset($payload['exp']) && $payload['exp'] < time()) {
        return null; // Expired
    }
    
    return $payload;
}

// Check Authentication Middleware
function getAuthUser() {
    $authHeader = '';
    
    // 1. Try apache_request_headers if available
    if (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (isset($headers['Authorization'])) {
            $authHeader = $headers['Authorization'];
        } elseif (isset($headers['authorization'])) {
            $authHeader = $headers['authorization'];
        }
    }
    
    // 2. Try $_SERVER['HTTP_AUTHORIZATION']
    if (empty($authHeader) && isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    }
    
    // 3. Try $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
    if (empty($authHeader) && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
    
    // 4. Try scanning all $_SERVER keys (case-insensitive check)
    if (empty($authHeader)) {
        foreach ($_SERVER as $key => $value) {
            if (substr($key, 0, 5) === 'HTTP_') {
                $headerName = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($key, 5)))));
                if ($headerName === 'Authorization') {
                    $authHeader = $value;
                    break;
                }
            }
        }
    }
    
    // 5. Try token from query parameter or post body (fallback for local servers stripping Authorization header)
    if (empty($authHeader) && isset($_GET['token'])) {
        $authHeader = 'Bearer ' . $_GET['token'];
    }
    if (empty($authHeader) && isset($_POST['token'])) {
        $authHeader = 'Bearer ' . $_POST['token'];
    }
    
    if (empty($authHeader)) {
        return null;
    }
    
    if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
        $token = $matches[1];
        return decodeJWT($token);
    }
    
    return null;
}

// Send standard JSON Response helper
function sendResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data);
    exit();
}

// Send standard Error Response helper
function sendError($message, $statusCode = 400) {
    sendResponse(['error' => $message], $statusCode);
}

// Robust HTTP Request Helper using cURL with a file_get_contents fallback
function makeHttpRequest($url) {
    if (function_exists('curl_init')) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        $response = curl_exec($ch);
        curl_close($ch);
        return $response;
    } else {
        $options = [
            'http' => [
                'method' => 'GET',
                'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n",
                'timeout' => 10,
                'follow_location' => 1
            ],
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false
            ]
        ];
        $context = stream_context_create($options);
        return @file_get_contents($url, false, $context);
    }
}
?>
