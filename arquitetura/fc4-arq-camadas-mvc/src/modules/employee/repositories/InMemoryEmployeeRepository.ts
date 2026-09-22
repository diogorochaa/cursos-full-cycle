import {EmployeeRepository} from "../../../interfaces/repositories/EmployeeRepository";
import {CreateEmployeeDTO} from "../dtos/CreateEmployeeDTO";
import {Employee} from "../models/Employee";
import {UpdateEmployeeDTO} from "../dtos/UpdateEmployeeDTO";
import {NotFoundError} from "../../../shared/errors/AppError";
import {v4 as uuidv4} from "uuid";

export class InMemoryEmployeeRepository implements EmployeeRepository {
    private employees: Employee[] = [];

    constructor() {
    }

    async create(createEmployeeDTO: CreateEmployeeDTO): Promise<Employee> {
        const newEmployee = {
            ...createEmployeeDTO,
            id: uuidv4(),
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        this.employees.push(newEmployee);

        return newEmployee;
    }

    async delete(id: string): Promise<void> {
        const employeeIndex = this.employees.findIndex(emp => emp.id === id)
        if (employeeIndex === -1) {
            throw new NotFoundError(`Funcionário com o id ${id} não foi encontrado`);
        }

        this.employees.splice(employeeIndex, 1);
    }

    async findByCompanyId(companyId: string): Promise<Employee[]> {
        return this.employees.filter(emp => emp.companyId === companyId)
    }

    async findById(id: string): Promise<Employee> {
        const employee = this.employees.find(emp => emp.id === id)
        if (!employee) {
            throw new NotFoundError(`Funcionário com o id ${id} não foi encontrado`);
        }

        return employee;
    }

    async update(id: string, updateEmployeeDTO: UpdateEmployeeDTO): Promise<Employee> {
        const employeeIndex = this.employees.findIndex(emp => emp.id === id)
        if (employeeIndex === -1) {
            throw new NotFoundError(`Funcionário com o id ${id} não foi encontrado`);
        }

        const updatedEmployee = {
            ...this.employees[employeeIndex],
            ...updateEmployeeDTO,
            updatedAt: new Date(),
        };

        this.employees[employeeIndex] = updatedEmployee
        return updatedEmployee
    }

}