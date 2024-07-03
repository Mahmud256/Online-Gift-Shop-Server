const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require('dotenv').config();
const cors = require("cors");
const app = express();
const SSLCommerzPayment = require('sslcommerz-lts');
const jwt = require('jsonwebtoken');

const port = process.env.PORT || 5000;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5cknjnc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

app.use(cors({
  origin: [
    'http://localhost:5173',
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

    //------------------ Payment Related API ------------------

    const store_id = process.env.STORE_ID;
    const store_passwd = process.env.STORE_PASS;
    const is_live = false; // true for live, false for sandbox

    const tran_id = new ObjectId().toString();

    app.post('/payments', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const cartItems = await cartCollection.find(query).toArray();

      if (!cartItems.length) {
        return res.status(400).send({ error: "No items in the cart" });
      }

      const total_amount = cartItems.reduce((total, item) => total + item.price, 0);

      const locationData = await locationCollection.findOne(query);

      if (!locationData) {
        return res.status(404).send({ error: "Location data not found" });
      }

      const data = {
        total_amount: total_amount,
        currency: 'BDT',
        tran_id: tran_id,
        success_url: 'http://localhost:3030/success',
        fail_url: 'http://localhost:3030/fail',
        cancel_url: 'http://localhost:3030/cancel',
        ipn_url: 'http://localhost:3030/ipn',
        shipping_method: 'Courier',
        product_name: cartItems.map(item => item.name).join(', '),
        product_profile: 'general',
        cus_name: locationData.name,
        cus_email: email,
        cus_add1: locationData.address,
        cus_add2: locationData.address,
        cus_city: locationData.city,
        cus_state: locationData.area,
        cus_postcode: locationData.postcode || '1000',
        cus_country: 'Bangladesh',
        cus_phone: locationData.phone,
        cus_fax: locationData.phone,
        ship_name: locationData.name,
        ship_add1: locationData.address,
        ship_add2: locationData.address,
        ship_city: locationData.city,
        ship_state: locationData.area,
        ship_postcode: locationData.postcode || '1000',
        ship_country: 'Bangladesh',
      };

      const paymentRecord = {
        email: email,
        tran_id: tran_id,
        amount: total_amount,
        status: 'Pending', // Initial status
        created_at: new Date()
      };

      await paymentCollection.insertOne(paymentRecord);

      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
      sslcz.init(data).then(apiResponse => {
        let GatewayPageURL = apiResponse.GatewayPageURL;
        res.send({ url: GatewayPageURL });
        console.log('Redirecting to: ', GatewayPageURL);
      });
    });

    app.get("/", (req, res) => {
      res.send("Crud is running...");
    });

    app.listen(port, () => {
      console.log(`Simple Crud is Running on port ${port}`);
    });

  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);
