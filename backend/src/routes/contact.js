const express = require('express');
const router = express.Router();
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// POST /api/contact
router.post('/', async (req, res) => {
  const { prenom, nom, email, mobile, sujet, message } = req.body;

  if (!prenom || !email || !sujet || !message) {
    return res.status(400).json({ error: 'Champs obligatoires manquants.' });
  }

  try {
    const result1 = await resend.emails.send({
      from: 'Seculoca <contact@seculoca.fr>',
      to: 'contact@seculoca.fr',
      reply_to: email,
      subject: `[Contact] ${sujet}`,
      html: `
        <h2>Nouveau message depuis seculoca.fr</h2>
        <p><strong>Prénom :</strong> ${prenom}</p>
        <p><strong>Nom :</strong> ${nom || '-'}</p>
        <p><strong>Email :</strong> ${email}</p>
        <p><strong>Mobile :</strong> ${mobile || '-'}</p>
        <p><strong>Sujet :</strong> ${sujet}</p>
        <hr/>
        <p><strong>Message :</strong></p>
        <p>${message}</p>
      `
    });

    if (result1.error) {
      console.error('Erreur Resend (email interne):', result1.error);
      return res.status(500).json({ error: 'Erreur lors de l\'envoi du message.' });
    }

    const result2 = await resend.emails.send({
      from: 'Seculoca <contact@seculoca.fr>',
      to: email,
      subject: 'Nous avons bien reçu votre message',
      html: `
        <h2>Bonjour ${prenom},</h2>
        <p>Merci pour votre message. Notre équipe vous répondra sous 24h ouvrées.</p>
        <p><strong>Sujet :</strong> ${sujet}</p>
        <p><strong>Message :</strong> ${message}</p>
        <br/>
        <p>L'équipe Seculoca</p>
        <a href="https://www.seculoca.fr">www.seculoca.fr</a>
      `
    });

    if (result2.error) {
      console.error('Erreur Resend (email confirmation):', result2.error);
      // On ne bloque pas ici, l'email principal est parti
    }

    res.json({ success: true, message: 'Message envoyé avec succès.' });

 } catch (error) {
    console.error('Erreur envoi email:', error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi du message.' });
 }
});

module.exports = router;