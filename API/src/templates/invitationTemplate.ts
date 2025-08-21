export const generateInvitationEmail = ({
  firstName,
  lastName,
  email,
  expiration,
  inviteLink,
  message,
}: {
  firstName: string;
  lastName: string;
  email: string;
  expiration: string;
  inviteLink: string;
  message: string;
}) => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Invitation to CaritasMotherTeresa</title>
      </head>
      <body style="font-family: sans-serif; background-color: #f9fafb; padding: 20px;">
        <table style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 8px; padding: 20px;">
          <tr>
            <td>
              <h2 style="margin-bottom: 10px;">Invitation to CaritasMotherTeresa</h2>
              <hr style="margin: 20px 0;" />
              <div style="margin-bottom: 20px; display: flex; align-items: center;">
                <div>
                  <strong>${firstName} ${lastName}</strong> (<a href="mailto:${email}">${email}</a>)
                </div>
              </div>
  
              <p style="font-size: 14px; margin-bottom: 15px;">
                You’ve been invited to join <strong>CaritasMotherTeresa</strong>. Click the button below to accept the invitation and set up your account.
              </p>
              <p style="font-size: 12px; color:rgb(9, 9, 9);">
                ${message}
              </p>
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; font-size: 14px; margin-bottom: 20px;">
                <p style="margin: 0;">Accept your invitation by clicking the button below.</p>
              </div>
  
              <div style="text-align: center; margin-bottom: 20px;">
                <a href="${inviteLink}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #2563eb; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; cursor: pointer;">
                  Accept Invitation
                </a>
              </div>
              <p style="font-size: 12px; color: #6b7280; margin-top: 12px;">
                If the button above doesn't work, copy and paste this link into your browser:
              </p>
              <p style="font-size: 12px; color: #6b7280; word-break: break-all;">
                <a href="${inviteLink}" target="_blank" rel="noopener noreferrer">${inviteLink}</a>
              </p>
  
              <p style="font-size: 12px; color: #9ca3af;">
                This invitation will expire on <strong>${expiration}</strong>.
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
