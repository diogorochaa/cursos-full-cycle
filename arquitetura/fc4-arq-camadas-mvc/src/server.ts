import express from "express";
import companyRoutes from './modules/company/routes/company.routes';
import employeeRoutes from './modules/employee/routes/employee.routes';
import { errorHandler } from './shared/errors/errorHandler';
import "express-async-errors";

const PORT = process.env.PORT || 3000;

const app = express();

app.use(express.json());

app.use(companyRoutes);
app.use(employeeRoutes);

app.use((req, res, next) => {
    res.status(404).json({
        status: 'error',
        message: 'Rota não encontrada',
    });
});

app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});