import nodemailer from "nodemailer";
import { generateInvitationEmail } from "../templates/invitationTemplate";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendInvitationEmail = async ({
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
}) => {
  const html = generateInvitationEmail({
    firstName,
    lastName,
    email,
    expiration,
    inviteLink,
    message,
  });
  const text = [
    `Invitation to CaritasMotherTeresa`,
    ``,
    `${firstName} ${lastName} (${email}) has been invited.`,
    message ? `Message: ${message}` : undefined,
    ``,
    `Accept your invitation using this link:`,
    inviteLink,
    ``,
    `This invitation will expire on ${expiration}.`,
  ]
    .filter(Boolean)
    .join('\n');

  await transporter.sendMail({
    from: `"CaritasMotherTeresa" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "You’ve been invited to join CaritasMotherTeresa",
    html,
    text,
  });
};

export const sendPasswordResetEmail = async ({
  email,
  resetLink,
}: {
  email: string;
  resetLink: string;
}) => {
  const html = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: sans-serif; background-color: #f9fafb; padding: 20px;">
        <table style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 8px; padding: 20px;">
          <tr>
            <td>
              <h2 style="margin-bottom: 10px;">Reset your password</h2>
              <p style="font-size: 14px; margin-bottom: 15px;">Click the button below to reset your password.</p>
              <div style="text-align: center; margin-bottom: 20px;">
                <a href="${resetLink}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #2563eb; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; cursor: pointer;">Reset Password</a>
              </div>
              <p style="font-size: 12px; color: #6b7280;">If the button above doesn't work, copy and paste this link into your browser:</p>
              <p style="font-size: 12px; color: #6b7280; word-break: break-all;">
                <a href="${resetLink}" target="_blank" rel="noopener noreferrer">${resetLink}</a>
              </p>
              <p style="font-size: 12px; color: #9ca3af;">If you did not request this, you can ignore this email.</p>
            </td>
          </tr>
        </table>
      </body>
    </html>`;

  const text = [
    `Reset your password`,
    ``,
    `Use this link to reset your password:`,
    resetLink,
    ``,
    `If you did not request this, you can ignore this email.`,
  ].join('\n');

  await transporter.sendMail({
    from: `"CaritasMotherTeresa" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Reset your password",
    html,
    text,
  });
};
