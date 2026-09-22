import {EmployeeService} from "../../../interfaces/services/EmployeeService";
import {CreateEmployeeDTO} from "../dtos/CreateEmployeeDTO";
import {UpdateEmployeeDTO} from "../dtos/UpdateEmployeeDTO";
import {EmployeeRepository} from "../../../interfaces/repositories/EmployeeRepository";
import {Employee} from "../models/Employee";
import {BadRequestError, NotFoundError} from "../../../shared/errors/AppError";
import {DocumentValidator} from "../../../shared/utils/documentValidator";
import {CompanyService} from "../../../interfaces/services/CompanyService";

export class EmployeeServiceImpl implements EmployeeService {
    constructor(private readonly employeeRepository: EmployeeRepository,
                private readonly companyService: CompanyService) {
    }

    async create(createEmployeeDTO: CreateEmployeeDTO): Promise<Employee> {
        if (!DocumentValidator.validateCPF(createEmployeeDTO.cpf)) {
            throw new BadRequestError("O CPF enviado é incorreto")
        }

        await this.companyService.findByID(createEmployeeDTO.companyId);

        return await this.employeeRepository.create(createEmployeeDTO);
    }

    async delete(id: string): Promise<void> {
        const employee = await this.employeeRepository.findById(id);
        if (!employee) {
            throw new NotFoundError("Employee doesn't exist");
        }

        return await this.employeeRepository.delete(id);
    }

    async findByCompanyId(companyId: string): Promise<Employee[]> {
        return await this.employeeRepository.findByCompanyId(companyId);
    }

    async findById(id: string): Promise<Employee> {
        return await this.employeeRepository.findById(id);
    }

    async update(id: string, updateEmployeeDTO: UpdateEmployeeDTO): Promise<Employee> {
        const employee = await this.employeeRepository.findById(id);
        if (!employee) {
            throw new NotFoundError("Employee doesn't exist");
        }

        return await this.employeeRepository.update(id, updateEmployeeDTO);
    }

}