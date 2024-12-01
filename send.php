<?php
// Configuration
$api_url = 'http://localhost:3000/api/send';

// Process form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $number = $_POST['number'] ?? '';
    $message = $_POST['message'] ?? '';
    
    // Basic validation
    $errors = [];
    if (empty($number)) {
        $errors[] = "Phone number is required";
    }
    if (empty($message)) {
        $errors[] = "Message is required";
    }
    
    // If no validation errors, send to API
    if (empty($errors)) {
        // Prepare the data
        $data = array(
            'number' => $number,
            'message' => $message
        );
        
        // Initialize cURL session
        $ch = curl_init($api_url);
        
        // Set cURL options
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array(
            'Content-Type: application/json'
        ));
        
        // Execute cURL request
        $response = curl_exec($ch);
        $http_status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        
        // Close cURL session
        curl_close($ch);
        
        // Process response
        $result = json_decode($response, true);
        
        if ($http_status === 200 && isset($result['success']) && $result['success']) {
            $success_message = "Message sent successfully! Message ID: " . $result['messageId'];
        } else {
            $error_message = $result['error'] ?? "Failed to send message. Please try again.";
        }
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Send WhatsApp Message</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 20px auto;
            padding: 20px;
        }
        .form-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
        }
        input[type="text"], textarea {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        button {
            background-color: #25D366;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        button:hover {
            background-color: #128C7E;
        }
        .error {
            color: red;
            margin-bottom: 10px;
        }
        .success {
            color: green;
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <h2>Send WhatsApp Message</h2>
    
    <?php if (!empty($errors)): ?>
        <div class="error">
            <?php foreach ($errors as $error): ?>
                <p><?php echo htmlspecialchars($error); ?></p>
            <?php endforeach; ?>
        </div>
    <?php endif; ?>
    
    <?php if (isset($success_message)): ?>
        <div class="success">
            <?php echo htmlspecialchars($success_message); ?>
        </div>
    <?php endif; ?>
    
    <?php if (isset($error_message)): ?>
        <div class="error">
            <?php echo htmlspecialchars($error_message); ?>
        </div>
    <?php endif; ?>
    
    <form method="POST" action="">
        <div class="form-group">
            <label for="number">Phone Number:</label>
            <input type="text" id="number" name="number" 
                   value="<?php echo htmlspecialchars($number ?? ''); ?>"
                   placeholder="Example: 1234567890">
            <small>Enter number without country code or special characters</small>
        </div>
        
        <div class="form-group">
            <label for="message">Message:</label>
            <textarea id="message" name="message" rows="4" 
                      placeholder="Enter your message here"><?php echo htmlspecialchars($message ?? ''); ?></textarea>
        </div>
        
        <button type="submit">Send Message</button>
    </form>
</body>
</html>