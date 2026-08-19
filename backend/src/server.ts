app.set("trust proxy", 1);

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "development-session-secret",

    resave: false,

    saveUninitialized: false,

    proxy: true,

    cookie: {
      secure: true,
      httpOnly: true,
      sameSite: "none",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);