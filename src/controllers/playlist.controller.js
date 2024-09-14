import mongoose, {isValidObjectId} from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";



const createPlaylist = asyncHandler(async (req, res) => {
    const { name, description } = req.body;

    const userId = req.user._id  // Assuming req.user is populated by verifyJWT middleware

    if(!name || !description) {
        throw new ApiError(400, "Playlist name and description are required");
    }

    const playlist = new Playlist({
        name,
        description,
        owner: userId,
        videos: []
    })

    await playlist.save();

    return res
    .status(201)
    .json(new ApiResponse(201, playlist, "Playlist created successfully"));
})


const getUserPlaylists = asyncHandler(async (req, res) => {
    const {userId} = req.params;

    if(!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user ID");
    }

    const playlists = await Playlist.find({owner: userId});

    return res
    .status(200)
    .json(new ApiResponse(200, playlists, "User playlists retrieved successfully"))
})


const getPlaylistById = asyncHandler(async (req, res) => {
    const {playlistId} = req.params;

    if(!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist ID");
    }

    const playlist = await Playlist.findById(playlistId).populate("videos");

    if(!playlist) {
        throw new ApiError(404, "Playlist not found")
    }

    return res
    .status(200)
    .json(new ApiResponse(200, playlist, "Playlist fetched successfully"))
})


const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId } = req.params;

    if(!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid playlist ID or videoID")
    }

    const playlist = await Playlist.findById(playlistId);

    if(!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    // Ensure that the playlist belongs to the authenticated user
    if(!playlist.owner.equals(req.user._id)) {
        throw new ApiError(403, "You do not have permission to modify the playlist")
    }

    // check if video already in playlist
    if(playlist.videos.includes(videoId)) {
        throw new ApiError(400, "Video already in playlist")
    }

    // if everything fine then add the video to the playlist
    playlist.videos.push(videoId);
    await playlist.save();

    // return the response 
    return res
    .status(200)
    .json(new ApiResponse(200, playlist, "Video added to playlist successfully"))
})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId } = req.params;

    if(!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid playlist ID or video ID");
    }

    const playlist = await Playlist.findById(playlistId);

    if(!playlist) {
        throw new ApiError(404, "Playlist not found")
    }

    // Ensure that the playlist belongs to the authenticated user
    if(!playlist.owner.equals(req.user._id)) {
        throw new ApiError(403, "You do not have permission to modify this playlist")
    }

    const videoIndex = playlist.videos.indexOf(videoId);

    if(videoIndex === -1) {
        throw new ApiError(400, "Video not found in playlist");
    }

    playlist.videos.splice(videoIndex, 1);
    await playlist.save();

    return res
    .status(200)
    .json(new ApiResponse(200, playlist, "Video removed from playlist successfully"))
})


const deletePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params;

    if(!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist ID");
    }

    const playlist = await Playlist.findById(playlistId);

    if(!playlist) {
        throw new ApiError(404, "Playlist not found")
    }

    // Ensure that the playlist belongs to the authenticated user 
    if(!playlist.owner.equals(req.user._id)) {
        throw new ApiError(403, "You do not have permission to delete this playlist")
    }

    await Playlist.findByIdAndDelete(playlistId)

    return res
    .status(200)
    .json(new ApiResponse(200, "Playlist deleted successfully"))
})


const updatePlaylist = asyncHandler(async(req, res) => {
    const {playlistId} = req.params;
    const {name, description} = req.body;

    if(!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist ID");
    }

    const playlist = await Playlist.findById(playlistId);

    if(!playlist) {
        throw new ApiError(404, "Playlist mot found");
    }

    // Ensure that the playlist belongs to the authenticated user
    if(!playlist.owner.equals(req.user._id)) {
        throw new ApiError(403, "You do not have permission to update this playlist")
    }

    if(name) playlist.name = name ;
    if(description) playlist.description = description

    await playlist.save()

    return res
    .status(200)
    .json(new ApiResponse(200, playlist, "Playlist updated successfully"))
})



export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}


