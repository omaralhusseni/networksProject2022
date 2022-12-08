const { render } = require('ejs');
var express = require('express');
var path = require('path');

var app = express();
var session = require('express-session')
app.set('trust proxy', 1) // trust first proxy
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true, maxAge: 6000000 }
}))

const MongoClient = require('mongodb').MongoClient

const connectionString = 'mongodb://localhost:27017'

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function (req, res) {
  res.render('login', { message: '' })
});


const autoGenToken = () => {
  const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  return token;
}

const checkToken = (token, callback) => {
  MongoClient.connect(
    connectionString,
    {
      useNewUrlParser: true,
      useUnifiedTopology: true
    },
    (err, client) => {
      if (err) {
        return console.log(err)
      }
      const db = client.db('networks')
      const session = db.collection('sessions')
      session.findOne({
        token
      }, (err, result) => {
        if (err) {
          return console.log(err)
        }
        if (result) {
          callback(true)
        } else {
          callback(false)
        }
      })
    })
}

const insertToken = (username, token) => {
  MongoClient.connect(
    connectionString,
    {
      useNewUrlParser: true,
      useUnifiedTopology: true
    },
    (err, client) => {
      if (err) {
        return console.log(err)
      }
      const db = client.db('networks')
      const session = db.collection('sessions')
      session.insertOne({
        username
        , token
      }, (err, result) => {
        if (err) {
          return console.log(err)
        }
      }
      )
    })
}

const deleteToken = (token) => {
  MongoClient.connect(
    connectionString,
    {
      useNewUrlParser: true,
      useUnifiedTopology: true
    },
    (err, client) => {
      if (err) {
        return console.log(err)
      }
      const db = client.db('networks')
      const session = db.collection('sessions')
      session.deleteMany({
        token
      }, (err, result) => {
        if (err) {
          return console.log(err)
        }
      }
      )
    })
}


app.post('/', function (req, res) {
  MongoClient.connect(
    connectionString,
    {
      useNewUrlParser: true,
      useUnifiedTopology: true
    },
    (err, client) => {
      if (err) {
        return console.log(err)
      }
      const db = client.db('networks')
      const users = db.collection('users')

      const username = req.body.username
      const password = req.body.password
      users.findOne({ username: username, password: password }, (err, result) => {
        if (err) {
          return console.log(err)
        }
        if (result) {
          const token = autoGenToken();
          req.session.token = token;
          if (result.token) {
            checkToken(result.token, (result) => {
              if (!result) {
                insertToken(username, token)
              }
            })
          }

          res.render('home', { username: username })
        } else {
          res.render('login', { message: 'Invalid username or password' })
        }
      }
      )

    }
  )

});

app.get('/register', function (req, res) {
  res.render('registration', { message: '' })
});

app.post('/register', function (req, res) {
  MongoClient.connect(
    connectionString,
    {
      useNewUrlParser: true,
      useUnifiedTopology: true
    },
    (err, client) => {
      if (err) {
        return console.log(err)
      }
      const db = client.db('networks')
      const users = db.collection('users')
      const username = req.body.username
      const password = req.body.password

      users.findOne({ username }, (err, result) => {
        if (err) {
          return console.log(err)
        }

        if (result) {
          res.render('registration', { message: 'Username already exists' })
        }
        else {
          users.insertOne({
            username
            , password
          }, (err, result) => {
            if (err) {
              return console.log(err)
            }
            const token = autoGenToken();
            req.session.token = token;
            if (result.token) {
              checkToken(result.token, (result) => {
                if (!result) {
                  insertToken(username, token)
                }
              })
            }
            res.render('login', { message: 'Registration successful' })
          }
          )
        }
      })
    })

});

app.get('/home', function (req, res) {
  MongoClient.connect(
    connectionString,
    {
      useNewUrlParser: true,
      useUnifiedTopology: true
    },
    (err, client) => {
      if (err) {
        return console.log(err)
      }
      const db = client.db('networks')
      const session = db.collection('sessions')
      const token = req.session.token
      session.findOne({
        token
      }, (err, result) => {
        if (err) {
          return console.log(err)
        }
        if (result) {
          res.render('home', { username: result.username.toString().toUpperCase() })
        } else {
          res.render('login', { message: 'Please login to continue' })
        }
      })
    })
});


app.get('/logout', (req, res) => {
  deleteToken(req.session.token)
  req.session.destroy();
  res.render('login', { message: 'Logged out successfully' })
})
app.listen(3000)



