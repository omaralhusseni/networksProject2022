const { render } = require('ejs');
var express = require('express');
var path = require('path');

var app = express();
app.set('trust proxy', 1) // trust first proxy

var session = require("express-session");
var cookieParser = require('cookie-parser');
app.use(cookieParser());
var MemoryStore = session.MemoryStore;
app.use(session({
  name: 'app.sid',
  secret: "1234567890QWERTY",
  resave: true,
  store: new MemoryStore(),
  saveUninitialized: true
}));

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

const insertTokenToDB = (username, token) => {
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
      })
    })
}

const removeTokenFromDB = (token) => {
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
      session.deleteOne({
        token
      }, (err, result) => {
        if (err) {
          return console.log(err)
        }
      })
    })
}

const checkTokenInDB = (token, callback) => {
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

let noLogin = false; // for testing purposes, set to true to skip login and use admin admin as login

const isLoggedIn = (req, res, callback) => {
  if (noLogin) {
    callback({ username: 'admin', token: 'admin', admin: true })
    return
  }

  if (req.session.token) {
    checkTokenInDB(req.session.token, (result) => {
      if (result) {
        callback(result)
      } else {
        res.render('login', { message: 'Please login' })
      }
    })
  } else {
    res.render('login', { message: 'Please login' })
  }
}



const checkUserAlreadyHasToken = (username, callback) => {
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
        username
      }, (err, result) => {
        if (err) {
          return console.log(err)
        }
        if (result) {
          callback(result)
        } else {
          callback(false)
        }
      })
    })
}


app.post('/', function (req, res) {
  const username = req.body.username
  const password = req.body.password

  if (username == '' || password == '') {
    res.render('login', { message: 'Please fill in all fields' })
  }

  if (username == 'admin' && password == 'admin') {
    noLogin = true;
    res.render('home', { message: 'User logged in as admin' })
    return
  }

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

      users.findOne({
        username
        , password
      }, (err, result) => {
        if (err) {
          return console.log(err)
        }
        if (result) {
          checkUserAlreadyHasToken(username, (result) => {
            if (result) {
              req.session.token = result.token
              req.session.username = username
              res.render('home', { message: 'User already logged in' })
            } else {
              const token = autoGenToken()
              insertTokenToDB(username, token)
              req.session.token = token
              req.session.username = username
              res.render('home', { message: 'User logged in' })
            }
          })
        } else {
          res.render('login', { message: 'Incorrect username or password' })
        }
      }
      )
    })
});

app.get('/registration', function (req, res) {
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

      if (username == '' || password == '') {
        res.render('registration', { message: 'Please fill in all fields' })
        return
      }

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
  isLoggedIn(req, res, (result) => {
    if (result) {
      res.render('home', { message: 'Welcome to the home page' })
    } else {
      res.render('login', { message: 'Please login to continue' })
    }
  })
});


app.get('/logout', (req, res) => {
  isLoggedIn(req, res, (result) => {
    noLogin = false;
    removeTokenFromDB(req.session.token)
    req.session.destroy()
    res.render('login', { message: 'You are logged out' })
  })
})



app.post('/wanttogo', (req, res) => {
  const dist = req.body.destination
  const token = req.session.token
  const username = req.session.username

  console.log(username, token, dist)

  isLoggedIn(req, res, (result) => {
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
        const destinations = db.collection('wanttogo')

        destinations.findOne({
          username
          , dist
        }, (err, result) => {
          if (err) {
            return console.log(err)
          }
          if (result) {
            res.send({ message: 'already exists' })
          } else {
            destinations.insertOne({
              username
              , dist
            }, (err, result) => {
              if (err) {
                return console.log(err)
              }
              res.send({ message: 'success' })
            })
          }
        })
      })
  })
})

app.get('/wanttogo', (req, res) => {
  const token = req.session.token
  const username = req.session.username

  isLoggedIn(req, res, (result) => {
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
        const destinations = db.collection('wanttogo')

        destinations.find({
          username
        }).toArray((err, result) => {
          if (err) {
            return console.log(err)
          }
          res.render('wanttogo', { distinations: result })
        })
      })
  })
})

app.post('/search', (req, res) => {
  const searchTerm = req.body.Search
  const distinations = [
    {
      name: 'rome',
      link: 'rome',
    },
    {
      name: 'paris',
      link: 'paris',
    },
    {
      name: 'Annapurna Circuit',
      link: 'annapurna',
    },
    {
      name: 'Inca Trail to Machu Picchu',
      link: 'inca',
    },
    {
      name: 'Santorini Island',
      link: 'santorini',
    },
    {
      name: 'Bali Island',
      link: 'bali',
    },
  ]

  const filteredDistinations = distinations.filter((distination) => {
    return distination.name.toLowerCase().includes(searchTerm.toLowerCase())
  })

  if (filteredDistinations.length == 0) {
    res.render('searchresults', { distinations: [{ name: 'No results found', link: '/home' }] })
    return
  }
  isLoggedIn(req, res, (result) => {
    res.render('searchresults', { distinations: filteredDistinations })
  })

})

app.get('/hiking', (req, res) => {
  isLoggedIn(req, res, (result) => {
    res.render('hiking', { message: '' })
  })
})


app.get('/inca', (req, res) => {
  isLoggedIn(req, res, (result) => {
    res.render('inca', { message: '' })
  })
})

app.get('/annapurna', (req, res) => {
  isLoggedIn(req, res, (result) => {
    res.render('annapurna', { message: '' })
  })
})

app.get('/cities', (req, res) => {
  isLoggedIn(req, res, (result) => {
    res.render('cities', { message: '' })
  })
})

app.get('/paris', (req, res) => {
  isLoggedIn(req, res, (result) => {
    res.render('paris', { message: '' })
  })
})

app.get('/rome', (req, res) => {
  isLoggedIn(req, res, (result) => {
    res.render('rome', { message: '' })
  })
})

app.get('/islands', (req, res) => {
  isLoggedIn(req, res, (result) => {
    res.render('islands', { message: '' })
  })
})

app.get('/bali', (req, res) => {
  isLoggedIn(req, res, (result) => {
    res.render('bali', { message: '' })
  })
})

app.get('/santorini', (req, res) => {
  isLoggedIn(req, res, (result) => {
    res.render('santorini', { message: '' })
  })
})

app.get('/wanttogo', (req, res) => {
  isLoggedIn(req, res, (result) => {
    res.render('wanttogo', { message: '' })
  })
})


app.listen(3000)