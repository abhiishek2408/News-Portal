const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const User = require('./Models/User');
const bcrypt = require('bcrypt');
const session = require('express-session');
const multer = require('multer');

const PORT = 3003;
// Creating an Express application
const app = express();

// Middleware to parse JSON requests and handle form data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'secretkey',
  resave: true,
  saveUninitialized: true
}));

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/poll', {
  // useNewUrlParser: true,
  // useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Error connecting to MongoDB:', err));

// Define schema and models
const optionSchema = new mongoose.Schema({
  name: String,
  votes: { type: Number, default: 0 }
});

const reviewSchema = new mongoose.Schema({
  name: String,
  rating: Number,
  comment: String
});

const Option = mongoose.model('Option', optionSchema);
const Review = mongoose.model('Review', reviewSchema);

// Initialize options with vote count
async function initializeOptions() {
  try {
    const options = await Option.find();
    if (options.length === 0) {
      const initialOptions = [
        { name: 'Politics', votes: 0 },
        { name: 'Economy', votes: 0 },
        { name: 'Sports', votes: 0 },
        { name: 'Technology', votes: 0 }
      ];
      await Option.insertMany(initialOptions);
      console.log('Options initialized successfully');
    }
  } catch (err) {
    console.error('Error initializing options:', err);
  }
}

// Static files middleware
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'withrevnews.html'));
});

app.get('/review', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reviewpage.html'));
});

app.get('/options', async (req, res) => {
  try {
    const options = await Option.find();
    res.json(options);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/vote', async (req, res) => {
  try {
    const { name } = req.body;
    const option = await Option.findOne({ name });
    if (!option) {
      return res.status(404).json({ message: 'Option not found' });
    }
    option.votes++;
    await option.save();
    res.status(200).json({ message: 'Vote counted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/submit-review', async (req, res) => {
  try {
    const { name, rating, comment } = req.body;
    const newReview = new Review({
      name,
      rating,
      comment
    });
    await newReview.save();
    res.status(201).json({ message: 'Review submitted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
      user: 'abhishekydv2408@gmail.com',
      pass: 'pteknpjsbtpazxlh',
  },
});

// POST route to handle form submission
app.post('/send-email', (req, res) => {
  const { name, email, subject, message } = req.body;

  const mailOptions = {
      from: 'abhishekydv2408@gmail.com',
      to: 'visheshyadav62@gmail.com',
      subject: subject,
      text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
          console.error(error);
          res.status(500).send('Error sending email');
      } else {
          console.log('Email sent: ' + info.response);
          res.send('Email sent successfully');
      }
  });
});



// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads'); // Files will be saved in the 'uploads' directory
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Append timestamp to file name
  }
});

const upload = multer({ storage });

// Define User schema and model
const profileSchema = new mongoose.Schema({
  userName: String,
  userEmail: String,
  age: String,
  address: String,
  profilePicture: String
});

const Profile = mongoose.model('Profile', profileSchema);

// Define routes
app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();
    res.status(200).json({ message: 'Signup successful' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('User not found');
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid password');
    }
    // Store user information in session
    req.session.user = user;
    res.status(200).json({ message: 'Login successful', name: user.name, email: user.email }); // Include user's name and email in the response
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
});


// Handle POST request to save profile data
app.post('/saveProfile', upload.single('profilePicture'), async (req, res) => {
  const { userName, userEmail, age, address } = req.body;
  const profilePicture = req.file ? req.file.filename : null;

  try {
    // Save the profile data to MongoDB
    const profile = new Profile({
      userName,
      userEmail,
      age,
      address,
      profilePicture
    });
    await profile.save();
    res.status(200).json({ message: 'Profile saved successfully.' });
  } catch (error) {
    console.error('Error saving profile:', error);
    res.status(500).json({ message: 'Error saving profile.' });
  }
});


// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});