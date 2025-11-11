import express from "express";
import mongod from "./db/db.js";
import mongoose from "mongoose";
import User from "./models/User.js";
import Like from "./models/Like.js";
import { authMidleware } from "./middlewares/authMiddleware.js";
import cors from "cors"
import { compareEncrypted, encryptOneWay, encryptTwoWay } from "./utils/encrypt.js";
import multer from "multer";


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'public/uploads')
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now();
      const fileExtesion = file.mimetype.split("/")[1];
      const name = `${file.fieldname} - ${uniqueSuffix}.${fileExtesion}`
      cb(null, name)
    }
  })
  
const upload = multer({ storage: storage })

const server = express();

server.use(express.json());
server.use(express.json());
server.use(express.urlencoded());
server.use(express.static('public'));
server.use(cors());

// const dbUrl = "mongodb+srv://vuejs_trabalho:backend_vuejs@cluster0.pikzxpy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
const url = "mongodb+srv://tinder_app:1234@cluster0.pikzxpy.mongodb.net/?appName=Cluster0"

// mongoose.connect(mongod.getUri()).then(() => {
mongoose.connect(url).then(() => {
    server.get("/health", (_, res) => {
        res.send({message: "It´s alive!"});
    });

    server.post("/users/sign-up", upload.single('img'), async (req,res) => {
        const {
            first_name,
            last_name,
            email,
            age,
            birthday,
            password,
            gender,
            preference_gender
        } = req.body;

        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
        return res.status(400).json({ error: "E-mail já cadastrado." });
        }

        const user = await User.create(
        {
            first_name, last_name, email,gender,preference_gender,
            age,birthday, password: await encryptOneWay(password),
            img: req.file.filename
        });

        console.log("aqui" + user)
        res.send(user);
    });

    server.post("/users/sign-in", async (req, res) => {
        const {
            email, password
        } = req.body;
       
        let encryptPassword = await encryptOneWay(password)

        const user = await User.findOne({
            email
        });

        if (!user) {
        return res.status(401).json({ error: "Usuário não encontrado." });
        }

        const passwordCheck = await compareEncrypted(password, user.password);
        if(passwordCheck) {
            res.send({
                token: await encryptTwoWay({
                    username: user.username,
                    id: user._id.toString()
                })
            })
        } else {
            res.status(401).send({error: "Tenta denovo"})
        }
    })

    server.get("/users", async (req,res) => {
        const users = await User.find();

        res.status(200).send(users)
    })

    server.get("/users/:id", async (req,res) => {
        const id = req.params.id

        const user = await User.findOne({
            _id: id
        });

        res.status(200).send(user)
    })

    server.get("/user/unliked", authMidleware, async (req,res)  => {
        const likedUsers = await Like.find({liker: req.current_user}).distinct("liked");


        const [unlikedUser] = await User.aggregate([
            {
                $match: {
                    _id: { $nin: [...likedUsers, req.current_user]},
                    gender: req.current_user.preference_gender
                }
            },
            {
                $sample: {size: 1}
            }
        ])


        if (!unlikedUser) return res.status(404).json({ message: 'Nenhum usuário disponível' })

        res.send(unlikedUser);
    })


    server.get("/user/matches", authMidleware, async (req, res) => {
        const likedUsers = await Like.find({ liker: req.current_user}).distinct('liked')

        const matchedIds = await Like.find({
        liker: { $in: likedUsers },
        liked: req.current_user
        }).distinct('liker')

        const matches = await User.find({ _id: { $in: matchedIds } })

        res.json(matches)
    });

    server.post("/likes", authMidleware, async (req,res) => {
        const {
            likedId,
        } = req.body;
        const liked = await User.findById(likedId);

        const like = await Like.create({
            liked,
            liker: req.current_user
        });

        const itsMatch = await Like.find({
            liked: req.current_user,
            liker: liked
        })


        res.send(itsMatch);
    });

    server.listen(3000);
}).catch((e) => {
    console.log("Erro:", e);
})

