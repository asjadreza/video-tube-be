import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload an image
// const uploadResult = await cloudinary.uploader
// .upload(
//     'https://res.cloudinary.com/demo/image/upload/getting-started/shoes.jpg', {
//         public_id: 'shoes',
//     }
// )
// .catch((error) => {
//     console.log(error);
// });

// console.log(uploadResult);

const  uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    // upload the file in cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    // console.log(response)
    // file has been uploaded successfully
    // console.log("The file is uploaded on cloudinary", response.url);
    fs.unlinkSync(localFilePath);
    return response;
  } catch (error) {
    // ensure file unlink even in case of error
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath); // remove the locally saved file as the upload operation got failed
    }
    return null;
  }
};


const deleteFromCloudinary = async (publicId, resourceType = "auto") => {
  try {
    const deleteResult = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    return deleteResult;
    
  } catch (error) {
    console.error("Error deleting file from cloudinary: ", error)
    return null;
  }
}

export { uploadOnCloudinary, deleteFromCloudinary };
