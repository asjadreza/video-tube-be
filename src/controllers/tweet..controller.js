import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createTweet = asyncHandler(async (req, res) => {
  // TODO: create Tweet

  // get the tweet content and userId
  const { content } = req.body;
  const userId = req.user._id;
  console.log(req);

  // check if user is valid
  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }
  // check if the content exists
  if (!content) {
    throw new ApiError(400, "Tweet content is required");
  }

  // Find the user
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  // create a new tweet
  const tweet = await Tweet.create({
    owner: user._id,
    content,
  });
  // Respond with the created tweet
  return res
    .status(201)
    .json(new ApiResponse(200, tweet, "Tweet created successfully"));
});

const getUserTweets = asyncHandler(async (req, res) => {
  // TODO: get user tweets

  // get user id
  const userId = req.user._id;
  //   const { userId } = req;

  // check if user is valid
  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  // Find the user and their tweets
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // if user exits then get all the tweets
  const tweets = await Tweet.find({
    owner: user._id,
  }).sort({ createdAt: -1 });

  // return the all the tweets
  return res
    .status(201)
    .json(new ApiResponse(200, tweets, "User tweets fetched successfully"));
});

const updateTweet = asyncHandler(async (req, res) => {
  // TODO: update tweet
  // get all the tweets and userId
  const { tweetId } = req.params;
  const { content } = req.body;
  const userId = req.user._id;

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  // validate content
  if (!content) {
    throw new ApiError(400, "Content is required to update the tweeet");
  }

  // find the tweet by id and owner
  const tweet = await Tweet.findOne({ _id: tweetId, owner: userId });
  if (!tweet) {
    throw new ApiError(
      404,
      "Tweet not found or you do not have permission to update this tweet"
    );
  }

  // update the tweet content
  tweet.content = content;
  await tweet.save();

  // return the updated tweet response
  return res
    .status(200)
    .json(new ApiResponse(200, tweet, "Tweet updated successfully"));
});

const deleteTweet = asyncHandler(async (req, res) => {
  //TODO: delete tweet
  // get the tweet id and and user id
  const { tweetId } = req.params;
  const userId = req.user._id;

  // validate user ID
  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }
  // validate tweet id
  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet ID");
  }

  // Find the tweet by id and owner
  const tweet = await Tweet.findOne({ _id: tweetId, owner: userId });
  if (!tweet) {
    throw new ApiError(
      404,
      "Tweet not found or do not have permission to delete this tweet"
    );
  }
  // delete the tweet content
  //   await tweet.remove();
  await tweet.deleteOne({ _id: tweetId });
  // return the response
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Tweet deleted successfully"));
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
