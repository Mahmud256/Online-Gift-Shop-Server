const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require('dotenv').config();
const cors = require("cors");
const app = express();

const port = process.env.PORT || 5000;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5cknjnc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


app.use(cors());
app.use(express.json());



// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();


    //Your Code Start Now!!!!!!!!!!!!!!!!!!!!

    const productCollection = client.db("ogs").collection("product");
    const cartCollection = client.db("ogs").collection("cart");


    //------------------ product Releted Api ------------------

    app.post('/product', async (req, res) => {
      const newProduct = req.body;
      const result = await productCollection.insertOne(newProduct);
      console.log(result);
      res.send(result);
    });

    app.get("/product", async (req, res) => {
      const result = await productCollection.find().toArray();
      res.send(result);
    });

    app.get('/product/:id', async (req, res) => {
      const id = req.params.id;
      console.log("Parms ID:", id);
      const query = { _id: new ObjectId(id) }
      const result = await productCollection.findOne(query);
      res.send(result);
    })

    app.put("/product/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      console.log("id", id, data);
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
      const result = await productCollection.updateOne(
        filter,
        updatedProduct
      );
      res.send(result);
    });

    app.delete("/product/:id", async (req, res) => {
      const id = req.params.id;
      console.log("delete", id);
      const query = {
        _id: new ObjectId(id),
      };
      const result = await productCollection.deleteOne(query);
      console.log(result);
      res.send(result);
    });

    //------------------ cart Releted Api ------------------
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
      const query = {
        _id: new ObjectId(id)
      };
      const result = await cartCollection.deleteOne(query);
      console.log(result);
      res.send(result);
    });





    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );


  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get("/", (req, res) => {
  res.send("Crud is running...");
});

app.listen(port, () => {
  console.log(`Simple Crud is Running on port ${port}`);
});