const merchants = {
  "sj-windows-001": {
    name: "SJ Home Upgrade Service",
    email: "sjcustominstall@gmail.com"
  }
};

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const sgMail = require("@sendgrid/mail");
const PDFDocument = require("pdfkit");

const app = express();
const port = process.env.PORT || 10000;

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL;
const TO_EMAIL = process.env.TO_EMAIL;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;

sgMail.setApiKey(SENDGRID_API_KEY);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin === ALLOWED_ORIGIN) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    }
  })
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

app.get("/", (req, res) => {
  res.json({ ok: true });
});

app.post("/submit", upload.array("photos", 5), async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      message,
      scenario,
      selectedOption,
      page,
      materialType,
      merchantId
    } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    const merchant = merchants[merchantId];
    let merchantEmail = TO_EMAIL;

    if (merchant) {
      merchantEmail = merchant.email;
    }

    const safePage = page || "general";
    const safeOption = selectedOption || "Not selected";
    const safeScenario = scenario || "Not specified";
    const safeMaterial = materialType || "Not specified";

    const attachments = [];

    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        attachments.push({
          content: file.buffer.toString("base64"),
          filename: file.originalname,
          type: file.mimetype,
          disposition: "attachment"
        });
      });
    }

    const subject = `New ${safePage} Request - ${merchant ? merchant.name : "Unknown Merchant"}`;

    const emailHtml = `
      <div style="font-family: Arial; line-height: 1.6;">
        <h2>New ${safePage} Request</h2>

        <p><strong>Merchant:</strong> ${merchantId || "N/A"}</p>

        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
        <p><strong>Project Type:</strong> ${safeScenario}</p>
        <p><strong>Material:</strong> ${safeMaterial}</p>
        <p><strong>Selected Option:</strong> ${safeOption}</p>

        <div style="margin-top:10px;">
          <strong>Details:</strong>
          <div style="background:#f6f6f6;padding:10px;border-radius:8px;">
            ${message}
          </div>
        </div>

      </div>
    `;

    await sgMail.send({
      to: merchantEmail,
      bcc: TO_EMAIL,
      from: FROM_EMAIL,
      replyTo: email,
      subject,
      html: emailHtml,
      attachments
    });

    await sgMail.send({
      to: email,
      from: FROM_EMAIL,
      subject: "We Received Your Request",
      html: `
        <div style="font-family:Arial;line-height:1.6;">
          <h2>Thank you for your request</h2>
          <p>We have received your project details.</p>
          <p>We will reply within 24 hours.</p>
        </div>
      `
    });

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

app.listen(port, () => {
  console.log("Server running");
});
