// Email templates for RSVP confirmations
const createRsvpConfirmationEmail = (guestData) => {
  const { guestName, partnerName, events, email } = guestData;
  
  // Build attendance summary
  const attendanceList = [];
  if (events.mehndi) attendanceList.push('Mehndi Ceremony (Saturday May 9th)');
  if (events.ceremony) attendanceList.push('Wedding Ceremony (Sunday May 10th)');
  if (events.reception) attendanceList.push('Reception (Sunday May 10th)');
  
  const attendanceText = attendanceList.length > 0 
    ? `We're excited to see you at:\n${attendanceList.map(event => `• ${event}`).join('\n')}`
    : 'Thank you for letting us know you cannot attend.';
  
  const partnerText = partnerName ? `You and ${partnerName}` : 'You';
  
  return {
    subject: '✨ RSVP Confirmation - Jessica & Shail\'s Wedding',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Georgia', serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; color: #4A9782; border-bottom: 2px solid #DCD0A8; padding-bottom: 20px; }
            .content { padding: 20px 0; }
            .event-list { background: #FFF9E5; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .footer { text-align: center; color: #666; font-size: 0.9em; border-top: 1px solid #DCD0A8; padding-top: 15px; }
            .highlight { color: #4A9782; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Thank You for Your RSVP!</h1>
              <p>Jessica & Shail's Wedding Celebration</p>
            </div>
            
            <div class="content">
              <p>Dear <span class="highlight">${guestName}</span>${partnerName ? ` and <span class="highlight">${partnerName}</span>` : ''},</p>
              
              <p>We have received your RSVP and are so grateful for your response!</p>
              
              <div class="event-list">
                <h3>Your RSVP Details:</h3>
                ${attendanceText}
              </div>
              
              ${attendanceList.length > 0 ? `
                <p><strong>Important Details:</strong></p>
                <ul>
                  <li><strong>Venue:</strong> [Your venue address]</li>
                  <li><strong>Parking:</strong> [Parking instructions]</li>
                  <li><strong>Dress Code:</strong> As mentioned on our website</li>
                  <li><strong>Contact:</strong> [Your contact info] for any questions</li>
                </ul>
                
                <p>We'll send additional details closer to the wedding date, including timeline and any special instructions.</p>
              ` : ''}
              
              <p>If you need to make any changes to your RSVP, please contact us directly at [your-email].</p>
              
              <p>We can't wait to celebrate with you!</p>
              
              <p>With love,<br>
              <span class="highlight">Jessica & Shail</span></p>
            </div>
            
            <div class="footer">
              <p>This is an automated confirmation of your RSVP submission.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Dear ${guestName}${partnerName ? ` and ${partnerName}` : ''},

Thank you for your RSVP to Jessica & Shail's Wedding!

${attendanceText}

${attendanceList.length > 0 ? `
Important Details:
- Venue: [Your venue address]
- Contact: [Your contact info] for questions

We'll send more details closer to the date.
` : ''}

If you need to change your RSVP, please contact us at [your-email].

We can't wait to celebrate with you!

With love,
Jessica & Shail

---
This is an automated confirmation of your RSVP submission.
    `
  };
};

module.exports = { createRsvpConfirmationEmail };
