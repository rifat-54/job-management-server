const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
require('dotenv').config()
const jwt=require('jsonwebtoken')
const cookieParser=require('cookie-parser')

const port = process.env.PORT || 9000
const app = express()

const corsOptions={
  origin:['http://localhost:5173'],
  credentials:true,
  optionalSuccessStatus:200
}

app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())


// const uri="mongodb://localhost:27017"

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.umkvz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {

    const db=client.db('job-management');
    const jobCollection=db.collection('jobs')
    const bidsCollection=db.collection('bids')


    // create token

    app.post('/jwt',async(req,res)=>{
      const email=req.body
      const token=jwt.sign(email,process.env.SECRET_KEY,{expiresIn:'1d'})
      res
      .cookie('token',token,{
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      })
      
      .send({success:true})
    })


    // remove token

    app.get('/logout',async(req,res)=>{
      res.clearCookie('token',{
        maxAge:0,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      }).send({success:true})
    })


    // verifay token

    const verifyToken=(req,res,next)=>{
      const token=req.cookies.token;
      if(!token){
        return res.status(401).send({message:'unauthorized access'})
      }
       jwt.verify(token,process.env.SECRET_KEY,(err,decoded)=>{
          if(err){
            return res.status(401).send({message:'unauthorized access'})
          }
          req.user=decoded;
          next()
       })
        
    }


    // add job
    app.post('/add-job',async (req,res)=>{
      const jobData=req.body;
      
      const result=await jobCollection.insertOne(jobData)
      res.send(result)
    })


    app.get('/jobs',async(req,res)=>{
      const result=await jobCollection.find().toArray()
      res.send(result)
    })

    app.get('/jobs/:email',async(req,res)=>{
      const email=req.params.email;
      const query={'buyer.email':email}
      const result=await jobCollection.find(query).toArray()
      res.send(result)
    })

    // update bid status

    app.patch('/bid-update-status/:id',async(req,res)=>{
      const id=req.params.id;
      const {status}=req.body;
      
      const filter={_id: new ObjectId(id)}
      const updateDoc={
        $set:{
          status:status
        }
      }

      const result= await bidsCollection.updateOne(filter,updateDoc)
      res.send(result)

    })

// get bids

    app.get('/bids/:email',verifyToken,async(req,res)=>{
      const tokenEmail=req.user.email;
      const email=req.params.email;
      const isBuyer=req.query.buyer;

      // vefify token email
      if(tokenEmail!==email){
        return res.status(403).send({message:'forbidden access'})
      }


      let query;
      if(isBuyer){
        query={buyer:email}
      }else{
        query={email}
      }
       
      const result=await bidsCollection.find(query).toArray()
     
      res.send(result)
    })

   
    // get all jobs

    app.get('/all-jobs',async(req,res)=>{
      const filter=req.query.filter;
      const search=req.query.search;
      const sort=req.query.sort;
      let options={}
      if(sort){
        options={
          sort:{deadline:sort==='asc'?1:-1}
        }
      }
      let query={
        job_title:{
          $regex:search,
          $options:'i'
        }
      }
      
      if(filter){
        query.category=filter
      }
      const result =await jobCollection.find(query,options).toArray()
      res.send(result)
    })



    // add bids

    app.post('/add-bids',async(req,res)=>{
      const data=req.body;

      // check if already bids this jobs
      const query={email:data.email,jobId:data.jobId}
      const alreadyExit= await bidsCollection.findOne(query)
      if(alreadyExit){
        return res.status(401).send('elready bits this job')
      }

      // insert bids
      const result =await bidsCollection.insertOne(data)

      // update bit count
      const filter={_id:new ObjectId(data.jobId)}
      const update={
        $inc:{
          bid_count:1
        }
      }
      const updateCount=await jobCollection.updateOne(filter,update)

      res.send(result)
    })



    // delete a job

    app.delete('/job/:id',async(req,res)=>{
      const id=req.params.id;
      const query={_id:new ObjectId(id)}
      const result= await jobCollection.deleteOne(query)
      res.send(result)
    })

    // get a specic data

    app.get('/job/:id',async(req,res)=>{
      const id=req.params.id;
      const query={_id:new ObjectId(id)}
      const result= await jobCollection.findOne(query)
      res.send(result)
    })

    // update a job

    app.put('/update-job/:id',async(req,res)=>{
      const id=req.params.id;
      const updateData=req.body;
      const filter={_id: new ObjectId(id)}
      const options={upsert:true}
      const updateDoc={
        $set:updateData
      }
      const result= await jobCollection.updateOne(filter,updateDoc,options)
      res.send(result)
    })



    

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)
app.get('/', (req, res) => {
  res.send('Hello from SoloSphere Server....')
})

app.listen(port, () => console.log(`Server running on port ${port}`))
