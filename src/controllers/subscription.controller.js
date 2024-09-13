import mongoose, {isValidObjectId} from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";


const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params;
    const subscriberId = req.user._id; // Assuming req.user is populated by verifyJWT middleware

    // validate channel ID and subscriber ID
    // if(!isValidObjectId(channelId) || !isValidObjectId(subscriberId)) {
    //     throw new ApiError(400, "Invalid channel ID or subscriber ID");
    // }

    if(!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID");
    }

    if(subscriberId.equals(channelId)) {
        throw new ApiError(400, "You cannot subscribe to yourself");
    }

    // check if subscription already exists
    const existingSubscription = await Subscription.findOne({
        subscriber: subscriberId,
        channel: channelId,
    });

    if(existingSubscription) {

        // await Subscription.findByIdAndDelete({_id: existingSubscription._id});
        await Subscription.deleteOne({_id: existingSubscription._id});
        return res
        .status(200)
        .json(new ApiResponse(200, "Unscubscribed successfully"));
        // throw new ApiError(400, "Subscription already exists");
    } else {
        const newSubscription = new Subscription({
            subscriber: subscriberId,
            channel: channelId
        })
        await newSubscription.save();
        return res
        .status(201)
        .json(new ApiResponse(201, newSubscription, "Subscribed successfully"));
    }
});



const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const {channelId} = req.params;

    // validate channel ID
    if(!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID");
    }

    // Find all subscribers for the channel
    // const subscribers = await Subscription
    // .find({channel: channelId})
    // .populate("subscriber", "name email") // Assuming 'User' model has 'name' and 'email' fields
    // .exec();

    const subscribers = await Subscription
    .find({channel: channelId})
    .populate({
        path: "subscriber",
        model: User, // Explicitly specify the User model
        select: "name email", // Select only the 'name' and 'email' fields
    })
    .exec();

    return res
    .status(200)
    .json(new ApiResponse(200, subscribers, "Subscribers retrieved successfully"));

})

const getSubscribedChannels = asyncHandler(async (req, res) => {
    // const {subscriberId} = req.params;

    const subscriberId = req.user._id; // Assuming req.user is populated by verifyJWT middleware    

    // Find all subscriptions for the subscriber
    // const subscriptions = await Subscription
    // .find({subscriber: subscriberId})
    // .populate("channel", "name")
    // .exec();

    // Find all the channels the subscriber has subscribed to
    const channels = await Subscription
    .find({subscriber: subscriberId})
    .populate("channel", "name")  // Assumating 'User'(channel) model has 'name' field
    .exec();

    return res
    .status(200)
    .json(new ApiResponse(200, channels, "Subscribed channels retrieved successfully"));
})


export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}