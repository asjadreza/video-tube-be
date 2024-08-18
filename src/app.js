import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();
// middlewares
// this will restricts the unwanted request to the server
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));
// if json request exceeds this limit then it will throw error
app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true, limit: "16kb"}));
app.use(express.static("public"))
app.use(cookieParser());


export { app };