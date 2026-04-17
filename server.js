const express = require("express");
const cors = require("cors");
const multer = require("multer");
const sgMail = require("@sendgrid/mail");

const app = express();
const port = process.env.PORT || 10000;

// Required environment variables
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL;
const TO_EMAIL = process.env.TO_EMAIL;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;

// Basic validation at startup
const requiredVars = {
  SENDGRID_API_KEY,
  FROM_EMAIL,
  TO_EMAIL,
  ALLOWED_ORIGIN
};

const missing = Object.entries(requiredVars)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

sgMail.setApiKey(SENDGRID_API_KEY);

// CORS: only allow your website
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow no-origin requests for health checks / curl if needed
      if (!origin) return callback(null, true);
      if (origin === ALLOWED_ORIGIN) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["POST", "GET"]
  })
);

// Multer setup: memory storage for optional image upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024 // 8MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, and WEBP images are allowed."));
    }
  }
});

// Health check
app.get("/", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "bb369-sendgrid-api",
    message: "API is running"
  });
});

// Submission endpoint
app.post("/submit", upload.single("photo"), async (req, res) => {
  try {
    const { name, email, phone, message, scenario, selectedOption, page } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: name, email, and message are required."
      });
    }

    const safePhone = phone || "Not provided";
    const safeScenario = scenario || "Not specified";
    const safeOption = selectedOption || "Not selected";
    const safePage = page || "windows-and-doors";

    const attachments = [];

    if (req.file) {
      attachments.push({
        content: req.file.buffer.toString("base64"),
        filename: req.file.originalname || "uploaded-image",
        type: req.file.mimetype,
        disposition: "attachment"
      });
    }

    const emailHtml = `
      <div style="font-family: Arial, Helvetica, sans-serif; color: #111; line-height: 1.6;">
        <h2 style="margin-bottom: 12px;">New Windows & Doors Request</h2>

        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(safePhone)}</p>
        <p><strong>Project Type:</strong> ${escapeHtml(safeScenario)}</p>
        <p><strong>Selected Option:</strong> ${escapeHtml(safeOption)}</p>
        <p><strong>Page:</strong> ${escapeHtml(safePage)}</p>

        <div style="margin-top: 16px;">
          <strong>Project Details:</strong>
          <div style="margin-top: 8px; padding: 12px; background: #f6f6f6; border-radius: 8px; white-space: pre-wrap;">
            ${escapeHtml(message)}
          </div>
        </div>

        <p style="margin-top: 18px; color: #666; font-size: 13px;">
          This message was submitted from the BB369 Platform Windows & Doors module.
        </p>
      </div>
    `;

    await sgMail.send({
      to: TO_EMAIL,
      from: FROM_EMAIL,
      replyTo: email,
      subject: "New Windows & Doors Request",
      html: emailHtml,
      attachments
    });

await sgMail.send({
  to: email,
  from: FROM_EMAIL,

  
  subject: "Your Request Received – BB369 Next Step",
  html: `
    <div style="font-family:Arial,sans-serif;line-height:1.6;">
      <h2>Thank you for your request</h2>

      <p>We’ve received your project details and our system is reviewing them.</p>

      <p><strong>Next step:</strong></p>

      <p>
        We recommend a quick consultation to confirm measurements and provide clear options (A / B / C).
      </p>

      <p>
        👉 <a href="https://cal.com/bb369tech/service-decision-review" target="_blank">
        Book your consultation here
        </a>
      </p>

      <p>This helps you get:</p>
      <ul>
        <li>Accurate pricing</li>
        <li>Clear upgrade options</li>
        <li>Faster decisions</li>
      </ul>

      <p>We’ll follow up if needed.</p>

      <p>Best regards,<br/>BB369 Team</p>
    </div>
  `
}); 
    return res.status(200).json({
      success: true,
      message: "Submission received successfully."
    });
  } catch (error) {
    console.error("Submission error:", error?.response?.body || error.message || error);
    return res.status(500).json({
      success: false,
      message: "Server error while sending email."
    });
  }
});

// Error handling for multer / CORS / general errors
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message || err);

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "This origin is not allowed."
    });
  }

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "The uploaded image must be smaller than 8MB."
    });
  }

  return res.status(400).json({
    success: false,
    message: err.message || "Request failed."
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`BB369 SendGrid API is running on port ${port}`);
});

// Simple HTML escaping
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
