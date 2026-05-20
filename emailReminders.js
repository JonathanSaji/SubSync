

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateLabel(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function normalizeSubscriptionRow(row) {
  return {
    ...row,
    id: Number(row.id),
    amount: Number(row.amount ?? 0),
    amountPerCycle: Number(row.amountPerCycle ?? 0),
    personalValue: row.personalValue === null || row.personalValue === undefined || row.personalValue === ''
      ? null
      : Number(row.personalValue)
  };
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
async function sendEmailReminders(pool) {
  let subscriptions = [];
  
  // Fetch subscriptions from database if pool is provided
  if (pool) {
    try {
      const result = await pool.query('SELECT * FROM subscriptions WHERE user_id IS NOT NULL');
      subscriptions = result.rows.map(normalizeSubscriptionRow);
      console.log(`Email reminders loaded ${subscriptions.length} subscriptions from DB`);
    } catch (err) {
      console.error('Failed to fetch subscriptions from database:', err.message);
      return;
    }
  } else {
    // Fallback if pool not provided (backward compatibility)
    console.error('sendEmailReminders called without pool parameter');
    return;
  }

  const today = new Date();
  today.setHours(0,0,0,0);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  for (const sub of subscriptions) {
    if (!sub.id || !sub.user_id || !sub.date) continue;

    // Get the user's email from the accounts table
    let userEmail;
    try {
      const accountResult = await pool.query(
        'SELECT email FROM accounts WHERE id = $1',
        [sub.user_id]
      );
      if (accountResult.rowCount === 0) {
        console.log(`Skipping subscription ${sub.id}: account not found for user_id ${sub.user_id}`);
        continue;
      }
      userEmail = accountResult.rows[0].email;
    } catch (err) {
      console.error(`Failed to fetch account for subscription ${sub.id}:`, err.message);
      continue;
    }

    const nextRenewal = getNextRenewalDate(sub.date, sub.billingCycle);
    const dayDiff = Math.ceil((nextRenewal - today) / (1000*60*60*24));

    if (dayDiff === 1) {
      // Check if reminder was already sent for this billing date
      if (sub.last_reminder_sent_date === sub.date) {
        console.log(`Reminder already sent for subscription ${sub.id} (${sub.name}) on date ${sub.date}`);
        continue;
      }

      try {
        const safeName = escapeHtml(sub.name || 'Subscription');
        const safeCycle = escapeHtml(sub.billingCycle || 'Monthly');
        const safeStatus = sub.isTrial ? 'Trial ending soon' : 'Active paid subscription';
        const amountPerCycle = Number(sub.amountPerCycle ?? sub.amount ?? 0);
        const formattedAmount = Number.isFinite(amountPerCycle) ? amountPerCycle.toFixed(2) : '0.00';
        const formattedDate = formatDateLabel(sub.date);

        const textBody = `Hi,

This is a reminder from SubSync that your subscription renews tomorrow.

Subscription: ${sub.name}
Amount: $${formattedAmount}
Billing cycle: ${sub.billingCycle ?? 'Monthly'}
Next billing date: ${formattedDate}
Status: ${sub.isTrial ? 'Trial ending soon' : 'Active paid subscription'}

Please make sure your payment method is up to date.

SubSync`;

        const htmlBody = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SubSync Reminder</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff8dc;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #ffd700;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="background:#FFD700;padding:22px 28px;">
                <p style="margin:0;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:#5b4a00;">SubSync Billing Alert</p>
                <h1 style="margin:8px 0 0;font-size:24px;line-height:1.2;color:#1f2937;">Renewal Reminder</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 14px;font-size:16px;line-height:1.5;color:#111827;">Your subscription <strong style="color:#8a6f00;">${safeName}</strong> renews tomorrow.</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f3d54e;border-radius:10px;background:#fffcf0;">
                  <tr>
                    <td style="padding:16px 18px;border-bottom:1px solid #f3d54e;">
                      <p style="margin:0;font-size:12px;color:#8a6f00;text-transform:uppercase;letter-spacing:0.7px;">Amount</p>
                      <p style="margin:6px 0 0;font-size:28px;font-weight:700;color:#7a6200;">$${formattedAmount}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 18px;border-bottom:1px solid #f3d54e;">
                      <p style="margin:0;font-size:14px;color:#374151;"><strong>Billing cycle:</strong> ${safeCycle}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 18px;border-bottom:1px solid #f3d54e;">
                      <p style="margin:0;font-size:14px;color:#374151;"><strong>Next billing date:</strong> ${formattedDate}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 18px;">
                      <p style="margin:0;font-size:14px;color:#374151;"><strong>Status:</strong> ${safeStatus}</p>
                    </td>
                  </tr>
                </table>
                <p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#4b5563;">Please make sure your payment method is up to date to avoid interruption.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#fff8dc;border-top:1px solid #ffd700;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;">This reminder was sent by SubSync.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

        const info = await transporter.sendMail({
          from: `"SubSync" <${process.env.EMAIL_USER}>`,
          to: userEmail,
          subject: `Subsync Reminder: ${sub.name} renews tomorrow.`,
          text: textBody,
          html: htmlBody
        });
        console.log(`Reminder sent to ${userEmail} for ${sub.name}: ${info.messageId}`);

        // Update the subscription to mark reminder as sent for this date
        await pool.query(
          'UPDATE subscriptions SET last_reminder_sent_date = $1 WHERE id = $2',
          [sub.date, sub.id]
        );
        console.log(`Updated subscription ${sub.id} last_reminder_sent_date to ${sub.date}`);
      } catch (err) {
        console.error(`Failed to send reminder for subscription ${sub.id}:`, err.message);
      }
    }
  }
}

module.exports = { sendEmailReminders };

if (require.main === module) {
  sendEmailReminders().catch(err => console.error(err));
}


