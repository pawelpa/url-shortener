require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const dns = require('dns');
const nanoid = require('nanoid');
const { MongoClient} = require('mongodb');

const databaseUrl = process.env.DATABASE;

const app = express();


app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());

MongoClient.connect(databaseUrl, { useNewUrlParser: true})
    .then( client => {
        app.locals.db = client.db('shortener');
    })
    .catch( () => console.error('Failed to connect to the database'));

const shortenURL = (db, url) => {
    const shortenedURLs = db.collection('shortenedURLs');
  
    return shortenedURLs.findOneAndUpdate({original_url: url},
    {
        $setOnInsert: {
            original_url: url,
            short_id: nanoid(7),
        },
    },
    {
        returnOriginal: false,
        upsert: true,
    }
    );
};

const checkIfShortenIdExists = (db, code) => db.collection('shortenedURLs')
    .findOne( { short_id: code});

app.get('/', (req, res) => {
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    res.sendFile(htmlPath);
});

app.get('/:short_id', (req, res) => {
    const shortId = req.params.short_id;
    const { db } = req.app.locals;
    checkIfShortenIdExists(db, shortId)
    .then(doc => {
        if( doc === null) return res.send("Could not find a link");
        res.redirect(doc.original_url);
    })
    .catch(console.error);
})

app.post('/new', (req, res) => {
    
    let originalUrl;
    
    try {
        
        originalUrl = new URL(req.body.url);
        
    } catch (err) {
        return res.status(400).send({ error: 'invalid URL'});
    }

    dns.lookup(originalUrl.hostname, (err, address) => {
        if (err) {
            return res.status(400).send({ error: "Address not found"});
        }

        const  {db} = req.app.locals;
        shortenURL(db, originalUrl.href)
        .then( result =>{
            const doc = result.value;
            res.json( {
                original_url: doc.original_url,
                short_id: doc.short_id,
            });
        })
        .catch(console.error);
       
       // res.send({ short_id:  req.body.url});
        console.log(address);
    });
    console.log(req.body);
    
});


app.set('port', process.env.PORT || 4100);

const server = app.listen(app.get('port'),() => {
    console.log(`Express running => PORT ${server.address().port}`);
});