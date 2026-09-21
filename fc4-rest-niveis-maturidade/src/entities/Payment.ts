import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Order } from "./Order";

export enum PaymentStatus {
    PAID = "PAID",
    ERROR = "ERROR",
}

export enum PaymentMethod {
    CREDIT_CARD = "CREDIT_CARD",
    BANK_SLIP = "BANK_SLIP",
}

@Entity()
export class Payment {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: "float" })
    amount: number;

    @CreateDateColumn()
    paymentDate: Date;

    @ManyToOne(() => Order, (order) => order.payments)
    order: Order;

    @Column({ type: "varchar", enum: PaymentMethod })
    method: PaymentMethod;

    @Column({ type: "varchar", enum: PaymentStatus, default: PaymentStatus.PAID })
    status: PaymentStatus;
}