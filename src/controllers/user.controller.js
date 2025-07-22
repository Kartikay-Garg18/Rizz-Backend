import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import bcrypt from "bcrypt";
import { signUpSchema, passwordValidation } from "../schemas/signup.schema.js";
import { loginSchema } from "../schemas/login.schema.js";
import { GoogleUser } from "../models/googleuser.model.js";
import { oauth2Client } from "../utils/googleConfig.js";
import axios from "axios";
import { Resend } from "resend";

const createUser = asyncHandler(async (req, res) => {
  // Set CORS headers for registration
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  
  try {
    const { username, email, password } = req.body;

    const result = signUpSchema.safeParse({ username, email, password });

    if (!result.success) {
      return res
        .status(400)
        .header('Access-Control-Allow-Origin', '*')
        .json(new ApiResponse(400, "", result.error.errors[0].message));
    }

  const checkUsername = await User.findOne({ username });

  if (checkUsername) {
    return res
      .status(400)
      .header('Access-Control-Allow-Origin', '*')
      .json(new ApiResponse(400, "", "Username already exists"));
  }

  const checkUser = await User.findOne({ email });

  if (checkUser) {
    return res
      .status(400)
      .header('Access-Control-Allow-Origin', '*')
      .json(new ApiResponse(400, "", "User with same email address exists"));
  }

  const user = await User.create({ username, email, password });

  if (!user) {
    return res
      .status(500)
      .header('Access-Control-Allow-Origin', '*')
      .json(new ApiResponse(500, "", "User could not be created"));
  }

  return res
    .status(201)
    .header('Access-Control-Allow-Origin', '*')
    .json(new ApiResponse(201, "", "User created successfully"));
  } catch (error) {
    console.error("User creation error:", error);
    return res
      .status(500)
      .header('Access-Control-Allow-Origin', '*')
      .json(new ApiResponse(500, "", "Registration failed: " + (error.message || "Unknown error")));
  }
});

const loginUser = asyncHandler(async (req, res) => {
  console.log("Login attempt received", { body: req.body, origin: req.headers.origin });
  
  // Force CORS headers for login endpoint
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    console.log("Handling OPTIONS in login controller");
    return res.status(204).end();
  }
  
  try {
    const { email, password } = req.body;

    const result = loginSchema.safeParse({ email, password });

    if (!result.success) {
      return res
        .status(400)
        .header('Access-Control-Allow-Origin', '*')
        .json(new ApiResponse(400, "", result.error.errors[0].message));
    }

    const checkUser = await User.findOne({ email });

    if (!checkUser) {
      return res
        .status(404)
        .header('Access-Control-Allow-Origin', '*')
        .json(new ApiResponse(404, "", "User does not exist"));
    }

    const isMatch = await checkUser.matchPassword(password);

    if (!isMatch) {
      return res
        .status(400)
        .header('Access-Control-Allow-Origin', '*')
        .json(new ApiResponse(400, "", "Invalid credentials"));
    }

    const { accessToken, refreshToken } = await generateToken(
      checkUser._id,
      User
    );

  if (!accessToken || !refreshToken) {
    return res
      .status(500)
      .header('Access-Control-Allow-Origin', '*')
      .json(new ApiResponse(500, "", "Token generation failed"));
  }

  const options = {
    httpOnly: false,
    secure: false,
    sameSite: "Strict",
  };
  const loggedInUser = {
    _id: checkUser._id, // Use _id for consistency
    id: checkUser._id,  // Keep id for backward compatibility
    email: checkUser.email,
    username: checkUser.username,
    profilePictureUrl: checkUser.profilePictureUrl,
  };

  // Force CORS headers again just before sending response
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    
  return res
    .status(200)
    .cookie("accessToken", accessToken, {
      ...options,
      maxAge: 24 * 60 * 60 * 1000,
    })
    .cookie("refreshToken", refreshToken, {
      ...options,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .json(
      new ApiResponse(
        200,
        { loggedInUser, accessToken, refreshToken },
        "User logged in successfully"
      )
    );
  } catch (error) {
    console.error("Login error:", error);
    return res
      .status(500)
      .header('Access-Control-Allow-Origin', '*')
      .json(new ApiResponse(500, "", "Login failed: " + (error.message || "Unknown error")));
  }
});

const generateToken = async (id, db) => {
  try {
    const user = await db.findById(id);
    if (!user) {
      throw new Error("User not found");
    }
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    if (!accessToken || !refreshToken) {
      throw new Error("Token generation failed");
    }

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    console.error("Token generation error:", error);
    throw error; // Throw the error so the calling function can handle it
  }
};

const getCurrentUser = asyncHandler(async (req, res) => {
  // Set CORS headers for get current user
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  
  try {
    const checkUser = req.user;
    const loggedInUser = {
      _id: checkUser._id, // Use _id for consistency
      id: checkUser._id,  // Keep id for backward compatibility
      email: checkUser.email,
      username: checkUser.username,
      profilePictureUrl: checkUser.profilePictureUrl,
    };
    return res
      .status(200)
      .header('Access-Control-Allow-Origin', '*')
      .json(new ApiResponse(200, loggedInUser, "User retrieved successfully"));
  } catch (error) {
    console.error("Get current user error:", error);
    return res
      .status(500)
      .header('Access-Control-Allow-Origin', '*')
      .json(new ApiResponse(500, "", "Failed to get user: " + (error.message || "Unknown error")));
  }
});

const googleLoginUser = asyncHandler(async (req, res) => {
  // Set CORS headers for Google login
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  
  try {
    const { code } = req.query;
    const googleResponse = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(googleResponse.tokens);
    const userData = await axios.get(
      `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${googleResponse.tokens.access_token}`
    );
    const { email, name, picture } = userData.data;
    
    let user = await GoogleUser.findOne({ email });
    if (!user) {
      user = await GoogleUser.create({
        username: name,
        email: email,
        profilePictureUrl: picture,
      });
      if (!user) {
        return res
          .status(500)
          .header('Access-Control-Allow-Origin', '*')
          .json(new ApiResponse(500, "", "User could not be created"));
      }
    }
    
    // Process token generation
    const { accessToken, refreshToken } = await generateToken(
      user._id,
      GoogleUser
    );

    if (!accessToken || !refreshToken) {
      return res
        .status(500)
        .header('Access-Control-Allow-Origin', '*')
        .json(new ApiResponse(500, "", "Token generation failed"));
    }

    const options = {
      httpOnly: false,
      secure: false,
      sameSite: "Strict",
    };
    const loggedInUser = {
      _id: user._id, // Use _id for consistency
      id: user._id,  // Keep id for backward compatibility
      email: email,
      username: name,
      profilePictureUrl: picture,
    };

    // Force CORS headers for Google login
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
      
    return res
      .status(200)
      .header('Access-Control-Allow-Origin', '*')
      .cookie("accessToken", accessToken, {
        ...options,
        maxAge: 24 * 60 * 60 * 1000,
      })
      .cookie("refreshToken", refreshToken, {
        ...options,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json(
        new ApiResponse(
          200,
          { loggedInUser, accessToken, refreshToken },
          "User logged in successfully"
        )
      );
  } catch (error) {
    console.error("Google login error:", error);
    return res
      .status(500)
      .header('Access-Control-Allow-Origin', '*')
      .json(new ApiResponse(500, "", "Google login failed: " + (error.message || "Unknown error")));
  }
});

const forgotPassword = asyncHandler(async (req, res) => {
  // Set CORS headers for forgot password
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  
  try {
    const { email } = req.body;
    const resend = new Resend(process.env.RESEND_API_KEY);

    const verifycode = Math.floor(100000 + Math.random() * 900000).toString();
    const codeExpiry = new Date(Date.now() + 10 * 60 * 1000);
    const user = await User.findOne({ email });
  if (!user) {
    return res
      .status(404)
      .header('Access-Control-Allow-Origin', '*')
      .json(new ApiResponse(404, "", "User does not exist"));
  }

  const { data, error } = await resend.emails.send({
    from: "Rizz <rizz@resend.dev>",
    to: email,
    subject: "Reset your password",
    html: `Dear ${user.username},<br><br>
            Just one more step before you get started.
            <br>
            You must confirm your identity using this one-time pass code: <strong>${verifycode}</strong>
            <br>
            Note: This code will expire in 10 minutes.
            <br><br>
            Sincerely,
            <br>
            Rizz Developement Team`,
  });

  if (error) {
    return res
      .status(500)
      .header('Access-Control-Allow-Origin', '*')
      .json(new ApiResponse(500, "", "Email could not be sent"));
  }

  return res
    .status(200)
    .header('Access-Control-Allow-Origin', '*')
    .json(
      new ApiResponse(
        200,
        { verifycode, codeExpiry },
        "Email sent successfully"
      )
    );
  } catch (error) {
    console.error("Forgot password error:", error);
    return res
      .status(500)
      .header('Access-Control-Allow-Origin', '*')
      .json(new ApiResponse(500, "", "Failed to process request: " + (error.message || "Unknown error")));
  }
});

const resetPassword = asyncHandler(async (req, res) => {
    // Set CORS headers for reset password
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    
    try {
        const { email, password } = req.body;
        const result = passwordValidation.safeParse(password);
        if (!result.success) {
            return res
              .status(400)
              .header('Access-Control-Allow-Origin', '*')
              .json(new ApiResponse(400, "", result.error.errors[0].message));
        }
        const hashedpassword = await bcrypt.hash(password, 10);
        const user = await User.findOneAndUpdate({ email }, { password: hashedpassword });
        if (!user) {
            return res
              .status(404)
              .header('Access-Control-Allow-Origin', '*')
              .json(new ApiResponse(404, "", "User does not exist"));
        }
        return res
          .status(200)
          .header('Access-Control-Allow-Origin', '*')
          .json(new ApiResponse(200, "", "Password reset successfully"));
    } catch (error) {
        console.error("Reset password error:", error);
        return res
          .status(500)
          .header('Access-Control-Allow-Origin', '*')
          .json(new ApiResponse(500, "", "Password could not be reset: " + (error.message || "Unknown error")));
    }
});

export {
  createUser,
  loginUser,
  generateToken,
  getCurrentUser,
  googleLoginUser,
  forgotPassword,
  resetPassword,
};
