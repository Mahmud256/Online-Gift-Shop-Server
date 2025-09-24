const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require('dotenv').config();
const cors = require("cors");
const app = express();
const SSLCommerzPayment = require('sslcommerz-lts');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const fs = require('fs');

const port = process.env.PORT || 5000;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5cknjnc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://online-gift-shop-a4212.web.app',
    'https://online-gift-shop.netlify.app'
  ],
  credentials: true
}));

app.use(express.json());

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

    const productCollection = client.db("ogs").collection("product");
    const cartCollection = client.db("ogs").collection("cart");
    const userCollection = client.db("ogs").collection("users");
    const locationCollection = client.db("ogs").collection("location");
    const paymentCollection = client.db("ogs").collection("payments");
    const orderCollection = client.db("ogs").collection("manageorder");

    //------------------ JWT Related API ------------------

    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    });

    //------------------ Middlewares Related API ------------------

    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'Unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'Unauthorized access' });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'Forbidden access' });
      }
      next();
    };

    //------------------ User Related API ------------------

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'User already exists', insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden access' });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    });

    app.delete('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    app.put("/users/admin/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    //------------------ Product Related API ------------------

    app.post('/product', async (req, res) => {
      const newProduct = req.body;
      const result = await productCollection.insertOne(newProduct);
      res.send(result);
    });

    app.get("/product", async (req, res) => {
      const result = await productCollection.find().toArray();
      res.send(result);
    });

    app.get('/product/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productCollection.findOne(query);
      res.send(result);
    });

    app.put("/product/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedProduct = {
        $set: {
          name: data.name,
          brand: data.brand,
          description: data.description,
          price: data.price,
          category: data.category,
          photos: data.photos
        },
      };
      const result = await productCollection.updateOne(filter, updatedProduct);
      res.send(result);
    });

    app.delete("/product/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productCollection.deleteOne(query);
      res.send(result);
    });

    //------------------ Cart Related API ------------------

    app.post('/cart', async (req, res) => {
      const cartProduct = req.body;
      const result = await cartCollection.insertOne(cartProduct);
      res.send(result);
    });

    app.get('/cart', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.delete('/cart/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    //------------------ Location Related API ------------------

    app.post('/location', async (req, res) => {
      const newLocation = req.body;
      const email = newLocation.email;

      if (!email) {
        return res.status(400).send({ error: "Email is required" });
      }

      const query = { email: email };
      const existingLocation = await locationCollection.findOne(query);

      if (existingLocation) {
        // Update the existing location
        const result = await locationCollection.updateOne(query, { $set: newLocation });
        res.send(result);
      } else {
        // Insert a new location
        const result = await locationCollection.insertOne(newLocation);
        res.send(result);
      }
    });

    app.get('/location', async (req, res) => {
      const email = req.query.email;

      if (!email) {
        return res.status(400).send({ error: "Email is required" });
      }

      const query = { email: email };
      const result = await locationCollection.find(query).toArray();
      res.send(result);
    });

    app.get('/location/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await locationCollection.findOne(query);
      res.send(result);
    });

    app.put("/location/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedLocation = {
        $set: {
          name: data.name,
          phone: data.phone,
          city: data.city,
          area: data.area,
          address: data.address,
        },
      };
      const result = await locationCollection.updateOne(filter, updatedLocation);
      res.send(result);
    });

    app.delete('/location/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await locationCollection.deleteOne(query);
      res.send(result);
    });

    //------------------ Manage Order Related API ------------------

    // ✅ Insert a new order (default product status: Pending)
    app.post('/manageorder', async (req, res) => {
      const orderProduct = req.body;

      // Ensure each product has an ObjectId and a status field
      orderProduct.cart = orderProduct.cart.map(product => ({
        ...product,
        _id: new ObjectId(),
        status: "Pending"
      }));

      const result = await orderCollection.insertOne(orderProduct);
      res.send(result);
    });

    // ✅ Get all orders
    app.get('/manageorder', async (req, res) => {
      const result = await orderCollection.find().toArray();
      res.send(result);
    });

    // ✅ Get one order
    app.get('/manageorder/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await orderCollection.findOne(query);
      res.send(result);
    });

    app.patch('/manageorder/:orderId/product/:productId', async (req, res) => {
      const { orderId, productId } = req.params;
      const { status } = req.body; // { status: "Completed" }

      const filter = { _id: new ObjectId(orderId), "cart._id": new ObjectId(productId) };
      const updateDoc = { $set: { "cart.$.status": status } };

      const result = await orderCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //------------------ Payment Related API ------------------

    app.post('/initiate-payment', async (req, res) => {
      const { amount, currency, product_name, customer_name, customer_email, customer_phone } = req.body;
      const tran_id = new ObjectId().toString();

      const paymentData = {
        total_amount: amount,
        currency: currency,
        tran_id: tran_id,
        success_url: `https://online-gift-shop-server.vercel.app/payments/success/${tran_id}`,
        fail_url: 'http://yourdomain.com/fail',
        cancel_url: 'http://yourdomain.com/cancel',
        ipn_url: 'http://yourdomain.com/ipn',
        product_name: product_name,
        product_category: 'General',
        product_profile: 'general',
        cus_name: customer_name,
        cus_email: customer_email,
        cus_add1: 'Customer Address',
        cus_city: 'Dhaka',
        cus_postcode: '1000',
        cus_country: 'Bangladesh',
        cus_phone: customer_phone,
        shipping_method: 'NO',
        num_of_item: 1,
      };

      // Save basic info before redirection
      await paymentCollection.insertOne({
        tran_id,
        total_amount: amount,
        cus_name: customer_name,
        cus_email: customer_email,
        status: 'Pending',
        createdAt: new Date(),
      });

      const sslcz = new SSLCommerzPayment(process.env.STORE_ID, process.env.STORE_PASS, false);
      sslcz.init(paymentData).then(apiResponse => {
        res.send({ url: apiResponse.GatewayPageURL });
      });
    });




    app.post('/payments/success/:tran_id', async (req, res) => {
      const tran_id = req.params.tran_id;

      const result = await paymentCollection.updateOne(
        { tran_id },
        { $set: { status: 'Success', successAt: new Date() } }
      );

      res.redirect(`https://online-gift-shop-a4212.web.app/payments/success/${tran_id}`);
    });




    app.post('/fail', async (req, res) => {
      const paymentInfo = req.body;
      res.status(400).send(paymentInfo);
    });

    app.post('/cancel', async (req, res) => {
      const paymentInfo = req.body;
      res.status(400).send(paymentInfo);
    });

    app.post('/ipn', async (req, res) => {
      const paymentInfo = req.body;
      const result = await paymentCollection.insertOne(paymentInfo);
      res.send(result);
    });


    app.get('/receipt/:tran_id', async (req, res) => {
      const tran_id = req.params.tran_id;
      const payment = await paymentCollection.findOne({ tran_id });

      if (!payment) {
        return res.status(404).send({ message: 'Payment not found' });
      }

      const doc = new PDFDocument();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=receipt-${tran_id}.pdf`);

      doc.pipe(res);

      // Content
      doc.fontSize(20).text('Payment Receipt', { align: 'center' });
      doc.moveDown();
      doc.fontSize(14).text(`Transaction ID: ${tran_id}`);
      doc.text(`Amount: ${payment.total_amount}`);
      doc.text(`Name: ${payment.cus_name}`);
      doc.text(`Email: ${payment.cus_email}`);
      doc.text(`Date: ${new Date().toLocaleString()}`);
      doc.end(); // Finalize the PDF and send
    });


    app.get("/", (req, res) => {
      res.send("Crud is running...");
    });

    app.listen(port, () => {
      console.log(`Simple Crud is Running on port ${port}`);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );

  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);