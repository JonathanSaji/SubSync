

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const subscriptionsPath = path.join('./data', 'subscriptions.json');
const emailsPath = path.join('./data', 'emails.json');       // array of emails
const emailsSentPath = path.join('./data', 'emailsSent.json'); // array of {subId, email}

// Helper: read JSON file
function readJSON(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// Helper: write JSON file
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// Calculate next renewal date based on start date & billing cycle
function getNextRenewalDate(startDateStr, billingCycle) {
  const [year, month, day] = startDateStr.split('-').map(Number);
  let nextDate = new Date(year, month - 1, day); // local midnight
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  while (nextDate < today) {
    switch (billingCycle.toLowerCase()) {
      case 'weekly': nextDate.setDate(nextDate.getDate() + 7); break;
      case 'monthly': nextDate.setMonth(nextDate.getMonth() + 1); break;
      case 'yearly': nextDate.setFullYear(nextDate.getFullYear() + 1); break;
      default: nextDate = new Date(today.getTime() + 1000*60*60*24);
    }
  }
  return nextDate;
}

// Main email sending function
async function sendEmailReminders() {
  const subscriptions = readJSON(subscriptionsPath);
  const emails = readJSON(emailsPath);                 // ["user@email.com", ...]
  const emailsSent = readJSON(emailsSentPath);        // [{subId, email}, ...]

  const today = new Date();
  today.setHours(0,0,0,0);

  let updated = false;

  const transporter = nodemailer.createTransport({
    host: 'smtp.mail.yahoo.com',
    port: 465,
    secure: true,
    auth: { user: 'zayaanhamid.zh@yahoo.com', pass: 'tztj iemj hyai rfhq' }
  });

  for (const sub of subscriptions) {
    if (!sub.id) continue;

    const nextRenewal = getNextRenewalDate(sub.date, sub.billingCycle);
    const dayDiff = Math.ceil((nextRenewal - today) / (1000*60*60*24));

    if (dayDiff === 1) {
      if (emails.length === 0) {
        console.log(`Skipping ${sub.name}: no emails to send yet.`);
        continue; // don't mark anything sent if no emails exist
      }

      for (const email of emails) {
        // check if this subscription was already sent to this email
        const alreadySent = emailsSent.some(
          entry => entry.subId === sub.id && entry.email === email
        );
        if (alreadySent) continue;

        const info = await transporter.sendMail({
          from: '"SubSync" <zayaanhamid.zh@yahoo.com>',
          to: email,
          subject: `Subsync Reminder: ${sub.name} renews tomorrow.`,
          text: `Hi! Your subscription "${sub.name}" will renew tomorrow. 
Amount: $${sub.amountPerCycle.toFixed(2)} (${sub.billingCycle ?? "Monthly"}). 
Next billing date: ${sub.date}. 
Status: ${sub.isTrial ? "Trial ends soon" : "Paid subscription"}.

Make sure your payment method is up to date!`
        });
        console.log(`Reminder sent to ${email} for ${sub.name}: ${info.messageId}`);

        emailsSent.push({ subId: sub.id, email });
        updated = true;
      }
    }
  }

  if (updated) writeJSON(emailsSentPath, emailsSent);
  //console.log("emailsSent.json updated");

}

module.exports = { sendEmailReminders };

if (require.main === module) {
  sendEmailReminders().catch(err => console.error(err));
}


