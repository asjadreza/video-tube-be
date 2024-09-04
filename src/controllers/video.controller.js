import mongoose, { isValidObjectId } from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    query = "",
    sortBy = "createdAt",
    sortType = "desc",
    userId,
  } = req.query;
  //TODO: get all videos based on query, sort, pagination

  // will only return the published videos by default
  const matchConditions = {
    isPublished: true,
  };

  // if a user ID is provided, filter by the owners videos
  if (userId && isValidObjectId(userId)) {
    matchConditions.owner = new mongoose.Types.ObjectId(userId);
    // matchConditions.owner = userId;
  }

  // if a query is provided, search by the title and description
  if (query.trim()) {
    matchConditions.$or = [
      { title: new RegExp(query, "i") },
      { description: new RegExp(query, "i") },
    ];
  }

  const videos = await Video.aggregate([
    { $match: matchConditions },
    {
      $sort: {
        [sortBy]: sortType === "asc" ? 1 : -1,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              fullname: 1,
              username: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        owner: {
          $first: "$owner",
        },
      },
    },
  ])
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  // count the total videos
  const totalVideos = await Video.countDocuments(matchConditions);

  // return the response
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { videos, totalVideos },
        "Videos fetched successfully"
      )
    );
});

const publishAVideo = asyncHandler(async (req, res) => {
  // TODO: get video, upload to cloudinary, create video

  // check if the user exists
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // get title, description and localpath of the video and thumbnail
  const { title, description } = req.body;
  const videoFileLocalPath = req.files?.videoFile[0]?.path;
  const thumbnailLocalPath = req.files?.thumbnail[0]?.path;
  // check if local paths exist
  if (!videoFileLocalPath || !thumbnailLocalPath) {
    throw new ApiError(400, "Video and thumbnail files are required");
  }

  // if exists then upload it on cloudinary
  const videoFile = await uploadOnCloudinary(videoFileLocalPath);
  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  // published/create the video
  const video = await Video.create({
    title,
    description,
    videoFile: videoFile.url,
    thumbnail: thumbnail.url,
    duration: videoFile.duration,
    owner: req.user._id,
  });

  // Update users total video count
  user.totalVideos = (user.totalVideos || 0) + 1;
  await user.save();

  // deleting files from cloudinary
  await deleteFromCloudinary(videoFile.public_id, "video");
  await deleteFromCloudinary(thumbnail.public_id, "image");

  // return the response if everything went well
  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video published successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  //TODO: get video by id

  const { videoId } = req.params;

  // check for valid videoId
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  // find the video ID
  const video = await Video.findById(videoId).populate(
    "owner",
    "fullname username avatar"
  );

  // check id the video exists
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  // return the response
  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video fetched successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;

  // Check if title and description are provided
  if (!title || !description) {
    throw new ApiError(
      400,
      "Title and description are required to update the video"
    );
  }

  // Find the video by ID
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  // Check if the authenticated user is the owner of the video
  if (!video.owner.equals(req.user._id)) {
    throw new ApiError(403, "You are not authorized to update this video");
  }

  // Update the title and description
  video.title = title;
  video.description = description;

  // Check if a new thumbnail is uploaded
  // const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

  const thumbnailLocalPath = req.file?.path;
  if (thumbnailLocalPath) {
    // Upload the new thumbnail to Cloudinary
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!thumbnail.url) {
      throw new ApiError(400, "Error while uploading thumbnail");
    }

    // Update the video with the new thumbnail URL
    video.thumbnail = thumbnail.url;

    // delete the updated thumbnail from cloudinary
    await deleteFromCloudinary(thumbnail.public_id, "image");
  }

  // Save the updated video
  await video.save();

  // Return the response with the updated video
  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  //TODO: delete video
  // get the video ID
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  //   find the video by id
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  // check if the authenticated user is the owner
  if (!video.owner.equals(req.user._id)) {
    throw new ApiError(403, "You are not authorized to delete this video");
  }

  // check if user exist
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  await Video.findByIdAndDelete(videoId);

  // Decrease users total video count
  user.totalVideos = (user.totalVideos || 1) - 1;
  await user.save();

  // TODO: Optionally delete the video file from cloud storage

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invaid video ID");
  }

  // if video ID is valid
  // then get the video
  const video = await Video.findById(videoId);

  // check again if video exists or not
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  // check if the authenticated user is the owner
  if (!video.owner.equals(req.user._id)) {
    throw new ApiError(
      403,
      "You are not authorized to change the status of this video"
    );
  }

  // if video exists
  video.isPublished = !video.isPublished;
  await video.save();

  // return the response
  return res
    .status(200)
    .json(
      new ApiResponse(200, video, "Video publish status updated successfully")
    );
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
