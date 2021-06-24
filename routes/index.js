import loginRoutes from "./loginRoutes";
import gameRoutes from "./gameRoutes";
import roomRoutes from './roomRoutes';

export default app => {
    app.use("/login", loginRoutes);
    app.use("/game", gameRoutes);
    app.use('/room', roomRoutes);
};
