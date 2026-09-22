import {NextFunction, Request, Response} from 'express';
import {responseSuccess} from "../../../shared/helpers/responseSuccess";
import {EmployeeService} from "../../../interfaces/services/EmployeeService";
import {validateCreateEmployee} from "../validators/validateCreateEmployee";
import {validateId} from "../../../shared/validators/validateId";
import {validateUpdateEmployee} from "../validators/validateUpdateEmployee";

export class EmployeeController {

    constructor(private readonly employeeService: EmployeeService) {
    }

    async create(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        const data = await validateCreateEmployee(req.body);

        const company = await this.employeeService.create(data);

        return responseSuccess(res, company, "Funcionário registrado com sucesso!", 201);
    }

    async update(req: Request, res: Response, next: NextFunction): Promise<Response> {
        const id = validateId(req.params.id);
        const data = await validateUpdateEmployee(req.body);

        const companies = await this.employeeService.update(id, data)

        return responseSuccess(res, companies, "Funcionário atualizado sucesso!");
    }

    async delete(req: Request, res: Response, next: NextFunction): Promise<Response> {
        const id = validateId(req.params.id);

        const company = await this.employeeService.delete(id)

        return responseSuccess(res, company, "Funcionário excluído com sucesso!");
    }

    async findByCompanyId(req: Request, res: Response, next: NextFunction): Promise<Response> {
        const companyId = validateId(req.params.companyId);

        const company = await this.employeeService.findByCompanyId(companyId)

        return responseSuccess(res, company, "Funcionários encontrados com sucesso!");
    }

    async findById(req: Request, res: Response, next: NextFunction): Promise<Response> {
        const id = validateId(req.params.id);

        const company = await this.employeeService.findById(id)

        return responseSuccess(res, company, "Funcionário encontrado com sucesso!");
    }
}
