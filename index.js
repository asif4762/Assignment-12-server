require('dotenv').config(); // Ensure this is at the very top
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jwt');
const nodemailer = require('nodemailer');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: ["http://localhost:5173"],
  credentials: true,
}));
app.use(express.json());

const sendEmail = async (emailAddress, emailData) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.TRANSPORTER_EMAIL,
        pass: process.env.TRANSPORTER_PASS,
      },
    });

    await transporter.verify();

    const mailBody = {
      from: `"RentEase" <${process.env.TRANSPORTER_EMAIL}>`,
      to: emailAddress,
      subject: emailData.subject,
      html: emailData.message,
    };

    await transporter.sendMail(mailBody);
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

app.get('/', (req, res) => {
  res.send('Assignment 12 is running');
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rurzeff.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const apartmentCollection = client.db('rentease').collection('apartment');
    const userCollection = client.db('rentease').collection('users');
    const paymentCollection = client.db('rentease').collection('payment');
    const anounceCollection = client.db('rentease').collection('anounce');
    const couponCollection = client.db('rentease').collection('coupons');


    app.get('/coupons', async (req, res) => {
      try {
        const result = await couponCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error('Error getting coupons:', error);
        res.status(500).send({ error: 'Internal server error', details: error.message });
      }
    })

    app.post('/coupons', async (req, res) => {
      const couponData = req.body;
      if (!couponData) {
        return res.status(400).send({ error: 'Invalid request' });
      }
      try {
        const result = await couponCollection.insertOne(couponData);
        res.send(result);
      } catch (error) {
        console.error('Error inserting coupon:', error);
        res.status(500).send({ error: 'Internal server error', details: error.message });
      }
    })

    app.post('/anouncement', async(req, res) => {
      const anounceData = req.body;
      if (!anounceData) {
        return res.status(400).send({ error: 'Invalid request' });
      }
      try {
        const result = await anounceCollection.insertOne(anounceData);
        res.send(result);
      } catch (error) {
        console.error('Error inserting anounce:', error);
        res.status(500).send({ error: 'Internal server error', details: error.message });
      }
    })

    app.get('/announcements', async (req, res) => {
      try {
        const result = await anounceCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error('Error getting announcements:', error);
        res.status(500).send({ error: 'Internal server error', details: error.message });
      }
    })

    app.put('/user/:email', async (req, res) => {
      const { email } = req.params;
      const changedData = req.body;
      console.log(changedData);
      if (!email || !changedData) {
        return res.status(400).send({ error: 'Invalid request' });
      }
    
      try {
        await userCollection.updateOne({ email }, { $set: changedData });
        res.send({ message: 'User updated successfully' });
      } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).send({ error: 'Internal server error', details: error.message });
      }
    });

    app.delete('/user/:email', async (req, res) => {
      const { email } = req.params;
      if (!email) {
        return res.status(400).send({ error: 'Invalid request' });
      }
      try {
        const result = await userCollection.deleteOne({ email });
        res.send(result);
      } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).send({ error: 'Internal server error', details: error.message });
      }
    });

    app.post('/payment-history', async (req, res) => {
      try {
        const paymentData = req.body;
        const result = await paymentCollection.insertOne(paymentData);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
      }
    });

    app.get('/payment-history/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email };
      try {
          const result = await paymentCollection.find(query).toArray();
          res.send(result);
      } catch (error) {
          console.error('Error fetching payment history:', error);
          res.status(500).send({ error: 'Internal server error' });
      }
    });

    app.post('/create-payment-intent', async (req, res) => {
      const { rent } = req.body;
      const rentIntent = parseInt(rent * 100);

      if (!rent || rentIntent < 1) {
        return res.status(400).send({ error: 'Invalid rent amount' });
      }

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: rentIntent,
          currency: 'usd',
          payment_method_types: ['card'],
        });
        res.send({ client_secret: paymentIntent.client_secret });
      } catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).send({ error: 'Internal server error', details: error.message });
      }
    });

    app.get('/apartments', async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 0;
        const size = parseInt(req.query.size) || 10;
        const result = await apartmentCollection.find().skip(page * size).limit(size).toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
      }
    });

    app.get('/apartments/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const query = { _id: new ObjectId(id) };
        const result = await apartmentCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
      }
    });

    app.get('/apartment-count', async (req, res) => {
      try {
        const count = await apartmentCollection.estimatedDocumentCount();
        res.send({ count });
      } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
      }
    });

    app.put('/user', async (req, res) => {
      try {
        const user = req.body;
        const query = { email: user?.email };
        const isExist = await userCollection.findOne(query);

        if (isExist) {
          if (user.status === 'Requested') {
            const result = await userCollection.updateOne(query, { $set: user });
            return res.send(result);
          } else {
            return res.send(isExist);
          }
        }

        const option = { upsert: true };
        const updateDoc = {
          $set: {
            ...user,
            timestamp: Date.now(),
          },
        };
        const result = await userCollection.updateOne(query, updateDoc, option);
        await sendEmail(user?.email, {
          subject: 'Welcome to RentEase!',
          message: 'Hope you will find your apartment',
        });
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
      }
    });

    app.get('/user/:email', async (req, res) => {
      try {
        const { email } = req.params;
        const query = { email };
        const result = await userCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
      }
    });

    app.get('/users', async (req, res) => {
      const result = await userCollection.find().toArray()
      res.send(result);
    })

    console.log('Connected to MongoDB successfully!');
  } catch (error) {
    console.error('Failed to connect to MongoDB', error);
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Assignment 12 is listening on port ${port}`);
});
