const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Build a JWT token that contains the user's id, role, and name.
// The token expires after 7 days so the user does not have to log in constantly.
const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// Handle new account creation. Hashes the password before saving so it is never stored as plain text.
exports.signup = async (req, res) => {
  try {
    const { name, location, phone, email, role, extraInfo, password } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: "User already exists" });
    }

    if ((role === "school" || role === "institution") && !extraInfo) {
      return res.status(400).json({ success: false, message: "School/Institution name is required" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({ name, location, phone, email, role, extraInfo, password: hashedPassword });

    res.status(201).json({ success: true, message: "User created", token: generateToken(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Handle login. Checks that the email exists and the password matches, then returns a token.
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }

    res.json({ success: true, message: "Login successful", token: generateToken(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};