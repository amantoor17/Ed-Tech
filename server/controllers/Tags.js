const Tag = require("../models/Tags");

//create Tag's Handler function

exports.createTag = async (req, res) => {
    try{
        const {name, description} = req.body;
        if(!name || !description){
            return res.status(400).json({
                success: false,
                message: 'All fields are required',
            });
        }
        //create entry in DB
        const tagDetails = await Tag.create({
            name: name,
            description: description,
        });
        console.log("This is tagDetail", tagDetails);

        return res.status(200).json({
            success: true,
            message: "Tag created Successfully.",
        });

    } catch(error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}

// Handler function to get all tags

exports.showAlltags = async (req, res) => {
    try{
        const allTags = await Tag.find({}, {name: true, description: true});
        res.status(200).json({
            success: true,
            message: "All tags returned successfully",
            allTags,
        });

    } catch(error){
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}