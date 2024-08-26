import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const refreshToken = user.generateRefreshToken(); // will save in database so that we dont ask for password each time
    const accessToken = user.generateAccessToken();
    user.refreshToken = refreshToken;
    // saving refreshToken in db
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating access and refresh tokens"
    );
  }
};
const registerUser = asyncHandler(async (req, res) => {
  // res.status(200).json({
  //     message: "ok"
  // })

  // get user details from front end
  const { fullname, email, username, password } = req.body;
  //   console.log(fullname, email, username, password);
  //   console.log(req.body)
  // validation - not empty
  if (!fullname || fullname.trim() === "") {
    throw new ApiError(400, "Fullname is required");
  }
  if (!email || email.trim() === "") {
    throw new ApiError(400, "Email is required");
  }
  // email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ApiError(400, "Invalid email format");
  }
  if (!username || username.trim() === "") {
    throw new ApiError(400, "Username is required");
  }

  if (!password || password.trim() === "") {
    throw new ApiError(400, "Password is required");
  }

  // check if user already exist: username, email
  const existedUser = await User.findOne({
    // using operator
    $or: [{ username }, { email }],
  });
  if (existedUser) {
    throw new ApiError(409, "User with this email or username already exist");
  }
  //   console.log(req.files);

  // check for images, check for avatar
  const avatarLocalpath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;

  // handling undefined error, warna to upar waale line se bhi kaam ho jata
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalpath) {
    throw new ApiError(400, "Avatar file is required");
  }
  // upload them to cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalpath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }
  // create user object - create entry in db
  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });
  // remove password and refresh token field from response
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  // check for user creation
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering user");
  }
  // return response
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered succesfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  // req.body -> data
  const { email, username, password } = req.body;

  // username or email
  if (!username && !email) {
    throw new ApiError(400, "username or email is required");
  }
  // find the user
  const user = await User.findOne({
    $or: [{ username }, { email }], // this or operator coming from mongodb, this means we are finding user of this email or username
  });
  if (!user) {
    throw new ApiError(404, "User does not exist");
  }
  // password the check
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }
  // access and refresh token
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  // send token in cookie
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  // yhan pe req.user ka access already hai kyunki hamne is route pe jwt middleware inject kra hai 
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined // undefining token to logout the user
      }
    },
    {
      new: true
    }
  )
  const options = {
    httpOnly: true,
    secure: true,
  }
  return res
  .status(200)
  .clearCookie("accessToken", options)
  .clearCookie("refreshToken", options)
  .json(new ApiResponse(200, {}, "User logged out successfully"))
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken // this token will send by user from front end

  if(!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request")
  }

  try {
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
  
    const user = await User.findById(decodedToken?._id)
  
    if(!user) {
      throw new ApiError(401, "Invalid refresh token")
    }
  
    // matching decoded(incoming) refresh token with the token saved in db 
    // this verify if the user refresh token and the db token are same,
    // we will allow this user as logged in without actually taking
    // credentails again
  
    if(incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used")
    }
    
    // if they matched 
    const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
  
    const options = {
      httpOnly: true,
      secure: true
    }
    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(
      new ApiResponse(
        200,
        {accessToken, refreshToken: newRefreshToken},
        "Access token refreshed successfully"
      )
    )
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token")
  }
})

export { registerUser, loginUser, logoutUser, refreshAccessToken };
