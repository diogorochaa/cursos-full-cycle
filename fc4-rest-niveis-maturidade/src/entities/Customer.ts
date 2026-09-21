import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Order } from "./Order";
import { User } from "./User";


@Entity()
export class Customer{
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    phone: string;

    @Column()
    address: string;

    @ManyToOne(() => User)
    user: User;

    @OneToMany(() => Order, order => order.customer)
    orders: Order[];
}