import { Like, Repository } from "typeorm";
import { Product } from "../entities/Product";
import { Category } from "../entities/Category";
import { In } from 'typeorm';
import { createDatabaseConnection } from "../database";

export class ProductService {
  constructor(private productRepository: Repository<Product>, private categoryRepository: Repository<Category>) {}

  async createProduct(
    name: string,
    slug: string,
    description: string,
    price: number,
    categoryIds: number[]
  ): Promise<Product> {
    const categories = await this.categoryRepository.find({ where: {
        id: In(categoryIds)
    } });

    const product = new Product();
    product.name = name;
    product.slug = slug;
    product.description = description;
    product.price = price;
    product.categories = categories;

    return await this.productRepository.save(product);
  }

  async getProductById(id: number): Promise<Product | null> {
    return await this.productRepository.findOne({ where: { id }, relations: ["categories"] });
  }

  async getProductBySlug(slug: string): Promise<Product | null> {
    return await this.productRepository.findOne({ where: { slug }, relations: ["categories"] });
  }

  async updateProduct(data: {
    id: number,
    name?: string,
    slug?: string,
    description?: string,
    price?: number,
    categoryIds?: number[]
  }): Promise<Product | null> {
    const { id, name, slug, description, price, categoryIds } = data;
    const product = await this.productRepository.findOne({ where: { id }, relations: ["categories"] });
    if (!product) {
      return null;
    }

    if (name) product.name = name;
    if (slug) product.slug = slug;
    if (description) product.description = description;
    if (price) product.price = price;
    if (categoryIds) {
      const categories = await this.categoryRepository.findByIds(categoryIds);
      product.categories = categories;
    }

    return await this.productRepository.save(product);
  }

  async deleteProduct(id: number): Promise<void> {
    await this.productRepository.delete({ id });
  }

  async listProducts(data: {
    page: number,
    limit: number,
    filter?: { name?: string; categories_slug: string[] }
  } = { page: 1, limit: 10 }): Promise<{ products: Product[]; total: number }> {
    const { page, limit, filter } = data;
    const where: any = {};
    if (filter?.name) {
      where.name = Like(`%${filter.name}%`);
    }
    if (filter?.categories_slug && filter.categories_slug.length > 0) {
      where.categories = { slug: In(filter.categories_slug) };
    }

    const [products, total] = await this.productRepository.findAndCount({
      where,
      relations: ["categories"],
      skip: (page - 1) * limit,
      take: limit,
    });

    return { products, total };
  }
}

export async function createProductService(): Promise<ProductService> {
  const { productRepository, categoryRepository } = await createDatabaseConnection();
  return new ProductService(productRepository, categoryRepository);
}