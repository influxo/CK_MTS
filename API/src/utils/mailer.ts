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

  await transporter.sendMail({
    from: `"CaritasMotherTeresa" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "You’ve been invited to join CaritasMotherTeresa",
    html,
  });
};
