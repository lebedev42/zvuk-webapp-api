const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const config = require("./config");

const app = express();

app.use(
  cors({
    origin: "*",
    methods: "OPTIONS,GET,HEAD,PUT,PATCH,POST,DELETE"
  })
);

app.use(express.json());

const postSchema = new mongoose.Schema({
  author: String,
  date: String,
  text: String,
  comments: Number
});

const commentSchema = new mongoose.Schema({
  author: String,
  date: String,
  text: String,
  likes: Number,
  usersLiked: [String],
  postId: mongoose.Schema.Types.ObjectId
});

const Post = mongoose.model("Post", postSchema);
const Comment = mongoose.model("Comment", commentSchema);

// Подключение к MongoDB
mongoose
  .connect(
    `mongodb://${config.MONGODB_USERNAME}:${config.MONGODB_PASSWORD}@${config.MONGODB_HOST}:${config.MONGODB_PORT}/${config.MONGODB_DBNAME}?authSource=admin&directConnection=true`
  )
  .then(() => console.log("Успешно подключено к MongoDB"))
  .catch((err) => console.error("Ошибка подключения к MongoDB", err));

// Получение всех постов
app.get("/posts", async (req, res) => {
  try {
    const posts = await Post.find();
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Получение поста по ID
app.get("/posts/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Пост не найден" });
    }
    res.json(post);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Получение всех комментариев к посту по postId
app.get("/posts/:postId/comments", async (req, res) => {
  try {
    const comments = await Comment.find({ postId: req.params.postId });
    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Получение комментария по ID
app.get("/comments/:id", async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: "Комментарий не найден" });
    }
    res.json(comment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Создание комментария
app.post("/comments", async (req, res) => {
  try {
    const { author, text, postId } = req.body;
    const postExists = await Post.findById(postId);

    if (!postExists) {
      return res.status(404).json({ message: "Пост не найден" });
    }

    const newComment = new Comment({
      author,
      text,
      postId,
      date: new Date().toISOString(),
      likes: 0,
      usersLiked: []
    });

    const savedComment = await newComment.save();
    await Post.updateOne({ _id: postId }, { $inc: { comments: 1 } });
    res.status(201).json(savedComment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Обновление комментария
app.patch("/comments/:id", async (req, res) => {
  try {
    const { text } = req.body;
    const updatedComment = await Comment.findByIdAndUpdate(
      req.params.id,
      { text },
      { new: true }
    );
    if (!updatedComment) {
      return res.status(404).json({ message: "Комментарий не найден" });
    }
    res.json(updatedComment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Удаление комментария
app.delete("/comments/:id", async (req, res) => {
  try {
    const deletedComment = await Comment.findByIdAndDelete(req.params.id);
    if (!deletedComment) {
      return res.status(404).json({ message: "Комментарий не найден" });
    }
    await Post.updateOne(
      { _id: deletedComment.postId },
      { $inc: { comments: -1 } }
    );
    res.json({ message: "Комментарий удален" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Лайк комментария
app.post("/comments/:id/like", async (req, res) => {
  try {
    const { userId } = req.body;

    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: "Комментарий не найден" });
    }
    comment.likes += 1;

    if (!comment?.usersLiked) {
      comment.usersLiked = [];
    }
    if (!comment.usersLiked.includes(userId)) {
      comment.usersLiked.push(userId);
    }

    await comment.save();
    res.json(comment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Удаление лайка комментария
app.post("/comments/:id/unlike", async (req, res) => {
  try {
    const { userId } = req.body;

    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: "Комментарий не найден" });
    }

    comment.likes = comment.likes - 1;

    if (comment?.usersLiked?.length && comment.usersLiked.includes(userId)) {
      comment.usersLiked = comment.usersLiked.filter((user) => user !== userId);
    }

    await comment.save();
    res.json(comment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Генерация постов
app.get("/generate-posts", async (req, res) => {
  // Удаление всех постов
  await Post.deleteMany({});

  const posts = [
    {
      author: "Звук",
      date: "4 ч назад",
      text: "Текст треда про продукт / разработку",
      comments: 0
    },
    {
      author: "Звук",
      date: "6 ч назад",
      text: "Текст треда про продукт / разработку",
      comments: 0
    },
    {
      author: "Звук",
      date: "7 ч назад",
      text: "Текст треда про продукт / разработку",
      comments: 0
    }
  ];

  try {
    await Post.insertMany(posts);
    res.status(201).json({
      message: "Посты успешно сгенерированы и добавлены в базу данных"
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
