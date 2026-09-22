import { DataSource } from "typeorm";
import { Product } from "./entities/Product";
import { Category } from "./entities/Category";
import { OrderItem } from "./entities/OrderItem";
import { Order } from "./entities/Order";
import { Payment } from "./entities/Payment";
import { Customer } from "./entities/Customer";
import { User } from "./entities/User";
import { Cart, CartItem } from "./entities/Cart";

let dataSource: DataSource;

export async function createDatabaseConnection() {
  if (!dataSource) {
    dataSource = new DataSource({
      type: "sqlite",
      //database: "database.sqlite",
      database: ":memory:",
      entities: [
        User,
        Customer,
        Product,
        Cart,
        CartItem,
        Category,
        OrderItem,
        Order,
        Payment,
      ],
      //logging: true,
      synchronize: true,
    });
    await dataSource.initialize();
  }

  return {
    customerRepository: dataSource.getRepository(Customer),
    userRepository: dataSource.getRepository(User),
    productRepository: dataSource.getRepository(Product),
    categoryRepository: dataSource.getRepository(Category),
    orderRepository: dataSource.getRepository(Order),
    orderItemRepository: dataSource.getRepository(OrderItem),
    cartRepository: dataSource.getRepository(Cart),
    cartItemRepository: dataSource.getRepository(CartItem),
    paymentRepository: dataSource.getRepository(Payment),
  };
}
