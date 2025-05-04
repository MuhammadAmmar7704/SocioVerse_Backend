import jwt from "jsonwebtoken";

const generateTokenAndSetCookie = (userId, roleId, roleName, res) => {
  const token = jwt.sign(
    { userID: userId, roleId, roleName },
    process.env.JWT_SECRET,
    {
      expiresIn: "15d",
    }
  );

  res.cookie("jwt", token, {
    httpOnly: true,
    maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days
    sameSite: "strict",
    secure: process.env.NODE_ENV !== "local",
  });

  return token;
};

export default generateTokenAndSetCookie;
