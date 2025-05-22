const User = require("../models/User");
const OTP = require("../models/OTP");
const otpGenerator = require("otp-generator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const sendMail = require("../utils/sendMail"); 


//Send Otp

exports.sendOTP = async (req, res) => {

    try{
        //fetch email from request's body
        const {email} = req.body;

        //check if user already exist
        const checkUserPresent = await User.findOne({email});

        //if user already exist, then return a response
        if(checkUserPresent) {
            return res.status(401).json({
                success: false,
                message: 'User already registered',
            })
        }

        //generate OTP
        var otp = otpGenerator.generate(6, {
            upperCaseAlphabets: false,
            lowerCaseAlphabets: false,
            specialChars: false,
        });
        console.log("OTP Generated: ", otp);

        //check unique otp or not
        const result = await OTP.findOne({otp: otp});

        while(result) {
            otp = otpGenerator.generate(6, {
            upperCaseAlphabets: false,
            lowerCaseAlphabets: false,
            specialChars: false,
        });
        result = await OTP.findOne({otp: otp});
        }

        const otpPayload = {email, otp};

        //create an entry for OTP in DB
        const otpBody = await OTP.create(otpPayload);
        console.log(otpBody);

        //return response successful
        res.status(200).json({
            success: true,
            message: 'OTP Sent Successfully',
            otp,
        })

    }catch(error) {

        console.log(error);
        return res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

//SignUp

exports.signUp = async (req, res) => {

    try{
        // data fetched from request's body
        const {
            firstName,
            lastName,
            email,
            password,
            confirmPassword,
            accountType,
            contactNumber,
            otp,
        } = req.body;

        // validate
        if(!firstName || !lastName || !email || !password || !confirmPassword || !otp) {
                return res.status(403).json({
                    success: false,
                    message: "All fields are required"
                })
            }

        // check if password and confirm password are equal
        if(password !== confirmPassword){
            return res.status(400).json({
                success: false,
                message: "Password and ConfirmPassword value does not match, please try again.",
            })
        }

        // check if user already exists or not
        const existingUser = await User.findOne({email});
        if(existingUser){
            return res.status(400).json({
                success: false,
                message: "User is already registered.",
            })
        }

        // find most recent OTP stored for the user
        const recentOtp = await OTP.find({email}).sort({createdAt:-1}).limit(1);
        console.log(recentOtp);

        // validate OTP
        if(recentOtp.length == 0) {
            //OTP not found
            return res.status(400).json({
                success: false,
                message: 'OTP not found',
            })
        } else if(otp !== recentOtp.otp) {
            // invalid OTP
            return res.status(400).json({
                success: false,
                message: "Invalid OTP",
            })
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // entry create in DB
        const profileDetails = await Profile.create({
            gender: null,
            dateOfBirth: null,
            about: null,
            contactNumber: null,
        });

        const user = await User.create({
            firstName,
            lastName,
            email,
            contactNumber,
            password: hashedPassword,
            accountType,
            additionalDetails: profileDetails._id,
            image: `https://api.dicebear.com/5.x/initials/svg?seed=${firstName} ${lastName}`, 
        })

        // return response
        return res.status(200).json({
            success: true,
            message: "User is registered Successfully",
            user,
        })

    } catch(error){
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "User cannot be registered. Please try again",
        })
    }
}

//Login

exports.login = async (req, res) => {
    try{
        // get data from request's body
        const {email, password} = req.body;

        // validation
        if(!email || !password) {
            return  res.status(403).json({
                success: false,
                message: 'All fields are required, please try again.',
            });
        }

        // user check exist or not
        const user = await User.findOne({email}).populate("additionalDetails");
        if(!user){
            return res.status(401).json({
                success: false,
                message: "User is not registered, please signup first.",
            });
        }

        // generate JWT, after password matching
        if(await bcrypt.compare(password, user.password)) {
            const payload = {
                email: user.email,
                id: user._id,
                role: user.role,
            }
            const token = jwt.sign(payload, process.env.JWT_SECRET, {
                expiresIn: "2h",
            });
            user.token = token;
            user.password = undefined;

             // create cookie and send response
            const options = {
                expires: new Date(Date.now() + 3*24*60*60*1000),
                httpOnly: true,
            }
            res.cookie("token", token, options).status(200).json({
                success: true,
                token,
                user,
                message: 'Logged in successfully',
            })

        }else{
            return res.status(401).json({
                success: false,
                message: 'Login Failed, Password is Incorrect.'
            })
        }
         
    } catch(error){
        console.log(error);
        return res.status(500).json({
            success: false,
            message: 'Login Failed, Please try again.',
        })
    }
};

//ChangePassword

exports.changePassword = async (req, res) => {
    try{
        //Get data from request's body
        const {oldPassword, newPassword,  confirmNewPassword} = req.body;

        //Validate Input
        if(!oldPassword || !newPassword || !confirmNewPassword){
            return res.status(400).json({
                success: false,
                message: "All fields are required.",
            });
        }

        if(newPassword !== confirmNewPassword){
            return res.status(400).json({
                success: false,
                message: "New passwords do not match.",
            });
        }

        //Get user from database
        const userId = req.user._id;
        const user = await User.findById(userId);

        if(!user){
            return res.status(404).json({
                success: false,
                message: "User not found.",
            });
        }

        //Compare old password
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if(!isMatch){
            return res.status(401).json({
                success: false,
                message: "Old password is incorrect.",
            });
        }

        //Hash new password and update in DB
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        //Send confirmation email
        await sendMail ({
            to: user.email,
            subject: "Password Changed Successfully",
            text: "Your password has beed updated successfully. If you didn't request this change, contact support immediately."
        });

        //return response
        return res.status(200).json({
            success: true,
            message: "Password Updated Successfully.",
        });


    } catch(error) {
        console.error("Error changing password: ", error);
        return res.status(500).json({
            success: false,
            message: "Something went wrong. Please try again."
        });
    }
    
}