/**
 * Full architecture template blueprints — create complete structures from Entry.
 * Production-ready examples: User, Order, Product, etc.
 * Each template run gets unique node IDs to avoid merging when multiple architectures coexist.
 */

import type { Blueprint, ForgeContext, ValidationResult, FileMutation, GraphMutation } from '../../../core/forge/types';
import type { GraphNodeType } from '../../../core/graph/types';

/** Returns nodeId/edgeId generators with a unique suffix so nodes from different template runs never collide. */
function createIdGenerators(): { nodeId: (type: string, label: string) => string; edgeId: (from: string, to: string) => string } {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return {
    nodeId: (type: string, label: string) =>
      `arch:${type}:${label.replace(/\s/g, '_').toLowerCase()}:${suffix}`,
    edgeId: (from: string, to: string) => `arch:edge:${from}:${to}`,
  };
}

const TEMPLATES: Array<{
  name: string;
  displayName: string;
  description: string;
  build: (ctx: ForgeContext) => { newNodes: GraphMutation['newNodes']; newEdges: GraphMutation['newEdges'] };
}> = [
  {
    name: 'arch-template-mvc',
    displayName: 'MVC (Full request flow)',
    description: 'Entry → Router → Middleware → Controller → FormRequest → Service → Repository → Model → Eloquent → Database (Migrations, Seeders, Factory); Controller → UserResource; Service → Event → Handler → Listeners → Job.',
    build: (ctx) => {
      const { nodeId, edgeId } = createIdGenerators();
      const fp = ctx.sourceNode.filePath ?? '';
      // Request flow: Router → Middleware → Controller → FormRequest → Service
      const middleware = nodeId('arch_middleware', 'AuthMiddleware');
      const router = nodeId('arch_router', 'Router');
      const controller = nodeId('arch_controller', 'UserController');
      const formRequest = nodeId('arch_form_request', 'StoreUserRequest');
      const service = nodeId('arch_service', 'UserService');
      const repo = nodeId('arch_repository', 'UserRepository');
      const model = nodeId('arch_model', 'User');
      const database = nodeId('arch_database', 'Database');
      const eloquent = nodeId('arch_eloquent', 'Eloquent');
      const migration = nodeId('arch_migration', 'Migrations');
      const seeder = nodeId('arch_seeder', 'Seeders');
      const factory = nodeId('arch_factory', 'Factory');
      const resource = nodeId('arch_resource', 'UserResource');
      // Event-driven: Service → Event → Handler → Listeners → Job
      const event = nodeId('arch_event', 'UserCreated');
      const handler = nodeId('arch_handler', 'EventServiceProvider');
      const listener1 = nodeId('arch_listener', 'SendWelcomeEmail');
      const listener2 = nodeId('arch_listener', 'LogUserCreated');
      const listener3 = nodeId('arch_listener', 'ClearUserCache');
      const job = nodeId('arch_job', 'Job');

      return {
        newNodes: [
          { id: middleware, type: 'arch_middleware' as GraphNodeType, filePath: fp, label: 'AuthMiddleware', metadata: {} },
          { id: router, type: 'arch_router' as GraphNodeType, filePath: fp, label: 'Router', metadata: {} },
          { id: controller, type: 'arch_controller' as GraphNodeType, filePath: fp, label: 'UserController', metadata: {} },
          { id: formRequest, type: 'arch_form_request' as GraphNodeType, filePath: fp, label: 'StoreUserRequest', metadata: {} },
          { id: service, type: 'arch_service' as GraphNodeType, filePath: fp, label: 'UserService', metadata: {} },
          { id: repo, type: 'arch_repository' as GraphNodeType, filePath: fp, label: 'UserRepository', metadata: {} },
          { id: model, type: 'arch_model' as GraphNodeType, filePath: fp, label: 'User', metadata: {} },
          { id: database, type: 'arch_database' as GraphNodeType, filePath: fp, label: 'Database', metadata: {} },
          { id: eloquent, type: 'arch_eloquent' as GraphNodeType, filePath: fp, label: 'Eloquent', metadata: {} },
          { id: migration, type: 'arch_migration' as GraphNodeType, filePath: fp, label: 'Migrations', metadata: {} },
          { id: seeder, type: 'arch_seeder' as GraphNodeType, filePath: fp, label: 'Seeders', metadata: {} },
          { id: factory, type: 'arch_factory' as GraphNodeType, filePath: fp, label: 'Factory', metadata: {} },
          { id: resource, type: 'arch_resource' as GraphNodeType, filePath: fp, label: 'UserResource', metadata: {} },
          { id: event, type: 'arch_event' as GraphNodeType, filePath: fp, label: 'UserCreated', metadata: {} },
          { id: handler, type: 'arch_handler' as GraphNodeType, filePath: fp, label: 'EventServiceProvider', metadata: {} },
          { id: listener1, type: 'arch_listener' as GraphNodeType, filePath: fp, label: 'SendWelcomeEmail', metadata: {} },
          { id: listener2, type: 'arch_listener' as GraphNodeType, filePath: fp, label: 'LogUserCreated', metadata: {} },
          { id: listener3, type: 'arch_listener' as GraphNodeType, filePath: fp, label: 'ClearUserCache', metadata: {} },
          { id: job, type: 'arch_job' as GraphNodeType, filePath: fp, label: 'Job', metadata: {} },
        ],
        newEdges: [
          // Entry → Router → Middleware → Controller → FormRequest → Service → Repository → Model → Eloquent → Database
          { id: edgeId(ctx.sourceNode.id, router), from: ctx.sourceNode.id, to: router, type: 'arch_dependency' },
          { id: edgeId(router, middleware), from: router, to: middleware, type: 'arch_dependency' },
          { id: edgeId(middleware, controller), from: middleware, to: controller, type: 'arch_dependency' },
          { id: edgeId(controller, formRequest), from: controller, to: formRequest, type: 'arch_dependency' },
          { id: edgeId(formRequest, service), from: formRequest, to: service, type: 'arch_dependency' },
          { id: edgeId(service, repo), from: service, to: repo, type: 'arch_dependency' },
          { id: edgeId(repo, model), from: repo, to: model, type: 'arch_dependency' },
          { id: edgeId(model, eloquent), from: model, to: eloquent, type: 'arch_dependency' },
          { id: edgeId(eloquent, database), from: eloquent, to: database, type: 'arch_dependency' },
          // Database → Migrations, Seeders, Factory
          { id: edgeId(database, migration), from: database, to: migration, type: 'arch_dependency' },
          { id: edgeId(database, seeder), from: database, to: seeder, type: 'arch_dependency' },
          { id: edgeId(database, factory), from: database, to: factory, type: 'arch_dependency' },
          // Controller → UserResource
          { id: edgeId(controller, resource), from: controller, to: resource, type: 'arch_dependency' },
          // Service → Event → Handler → Listeners; one Listener → Job
          { id: edgeId(service, event), from: service, to: event, type: 'arch_dependency' },
          { id: edgeId(event, handler), from: event, to: handler, type: 'arch_dependency' },
          { id: edgeId(handler, listener1), from: handler, to: listener1, type: 'arch_dependency' },
          { id: edgeId(handler, listener2), from: handler, to: listener2, type: 'arch_dependency' },
          { id: edgeId(handler, listener3), from: handler, to: listener3, type: 'arch_dependency' },
          { id: edgeId(listener1, job), from: listener1, to: job, type: 'arch_dependency' },
        ],
      };
    },
  },
  {
    name: 'arch-template-clean',
    displayName: 'Clean Architecture',
    description: 'Entry → Presentation → Controller; Controller → UseCase & Repository; Domain → UseCase; Repository Interface → UseCase; Repository → UseCase; DI Container → Repository Interface & Repository.',
    build: (ctx) => {
      const { nodeId, edgeId } = createIdGenerators();
      const fp = ctx.sourceNode.filePath ?? '';
      // Presentation → Controller
      const presentation = nodeId('arch_entry_interface', 'Presentation');
      const controller = nodeId('arch_controller', 'UserController');
      // Application: UseCase
      const useCase = nodeId('arch_use_case', 'CreateUserUseCase');
      // Domain
      const domain = nodeId('arch_domain', 'User');
      // Repository port and implementation
      const repoInterface = nodeId('arch_repository_interface', 'UserRepositoryInterface');
      const repository = nodeId('arch_repository', 'UserRepository');
      // DI Container (wires dependencies)
      const diContainer = nodeId('arch_di_container', 'DI Container');

      return {
        newNodes: [
          { id: presentation, type: 'arch_entry_interface' as GraphNodeType, filePath: fp, label: 'Presentation', metadata: {} },
          { id: controller, type: 'arch_controller' as GraphNodeType, filePath: fp, label: 'UserController', metadata: {} },
          { id: useCase, type: 'arch_use_case' as GraphNodeType, filePath: fp, label: 'CreateUserUseCase', metadata: {} },
          { id: domain, type: 'arch_domain' as GraphNodeType, filePath: fp, label: 'User', metadata: {} },
          { id: repoInterface, type: 'arch_repository_interface' as GraphNodeType, filePath: fp, label: 'UserRepositoryInterface', metadata: {} },
          { id: repository, type: 'arch_repository' as GraphNodeType, filePath: fp, label: 'UserRepository', metadata: {} },
          { id: diContainer, type: 'arch_di_container' as GraphNodeType, filePath: fp, label: 'DI Container', metadata: {} },
        ],
        newEdges: [
          // Entry → Presentation → Controller
          { id: edgeId(ctx.sourceNode.id, presentation), from: ctx.sourceNode.id, to: presentation, type: 'arch_dependency' },
          { id: edgeId(presentation, controller), from: presentation, to: controller, type: 'arch_dependency' },
          // Domain → UseCase
          { id: edgeId(domain, useCase), from: domain, to: useCase, type: 'arch_dependency' },
          // DI Container → Repository Interface & Repository
          { id: edgeId(diContainer, repoInterface), from: diContainer, to: repoInterface, type: 'arch_dependency' },
          { id: edgeId(diContainer, repository), from: diContainer, to: repository, type: 'arch_dependency' },
          // Repository → UseCase, Repository Interface → UseCase
          { id: edgeId(repository, useCase), from: repository, to: useCase, type: 'arch_dependency' },
          { id: edgeId(repoInterface, useCase), from: repoInterface, to: useCase, type: 'arch_dependency' },
          // Controller → Repository & UseCase
          { id: edgeId(controller, repository), from: controller, to: repository, type: 'arch_dependency' },
          { id: edgeId(controller, useCase), from: controller, to: useCase, type: 'arch_dependency' },
        ],
      };
    },
  },
  {
    name: 'arch-template-modular',
    displayName: 'Modular Monolith',
    description: 'Two modules (User, Order); each module follows Clean Architecture: Presentation → Controller, UseCase, Domain, Repository Interface, Repository, DI Container.',
    build: (ctx) => {
      const { nodeId, edgeId } = createIdGenerators();
      const fp = ctx.sourceNode.filePath ?? '';

      // —— User module (Clean Architecture) ——
      const userMod = nodeId('arch_module', 'User');
      const userPresentation = nodeId('arch_entry_interface', 'Presentation (User)');
      const userController = nodeId('arch_controller', 'UserController');
      const userUseCase = nodeId('arch_use_case', 'CreateUserUseCase');
      const userDomain = nodeId('arch_domain', 'User');
      const userRepoInterface = nodeId('arch_repository_interface', 'UserRepositoryInterface');
      const userRepository = nodeId('arch_repository', 'UserRepository');
      const userDiContainer = nodeId('arch_di_container', 'DI Container (User)');

      // —— Order module (Clean Architecture) ——
      const orderMod = nodeId('arch_module', 'Order');
      const orderPresentation = nodeId('arch_entry_interface', 'Presentation (Order)');
      const orderController = nodeId('arch_controller', 'OrderController');
      const orderUseCase = nodeId('arch_use_case', 'CreateOrderUseCase');
      const orderDomain = nodeId('arch_domain', 'Order');
      const orderRepoInterface = nodeId('arch_repository_interface', 'OrderRepositoryInterface');
      const orderRepository = nodeId('arch_repository', 'OrderRepository');
      const orderDiContainer = nodeId('arch_di_container', 'DI Container (Order)');

      return {
        newNodes: [
          // User module
          { id: userMod, type: 'arch_module' as GraphNodeType, filePath: fp, label: 'User', metadata: {} },
          { id: userPresentation, type: 'arch_entry_interface' as GraphNodeType, filePath: fp, label: 'Presentation (User)', metadata: {} },
          { id: userController, type: 'arch_controller' as GraphNodeType, filePath: fp, label: 'UserController', metadata: {} },
          { id: userUseCase, type: 'arch_use_case' as GraphNodeType, filePath: fp, label: 'CreateUserUseCase', metadata: {} },
          { id: userDomain, type: 'arch_domain' as GraphNodeType, filePath: fp, label: 'User', metadata: {} },
          { id: userRepoInterface, type: 'arch_repository_interface' as GraphNodeType, filePath: fp, label: 'UserRepositoryInterface', metadata: {} },
          { id: userRepository, type: 'arch_repository' as GraphNodeType, filePath: fp, label: 'UserRepository', metadata: {} },
          { id: userDiContainer, type: 'arch_di_container' as GraphNodeType, filePath: fp, label: 'DI Container (User)', metadata: {} },
          // Order module
          { id: orderMod, type: 'arch_module' as GraphNodeType, filePath: fp, label: 'Order', metadata: {} },
          { id: orderPresentation, type: 'arch_entry_interface' as GraphNodeType, filePath: fp, label: 'Presentation (Order)', metadata: {} },
          { id: orderController, type: 'arch_controller' as GraphNodeType, filePath: fp, label: 'OrderController', metadata: {} },
          { id: orderUseCase, type: 'arch_use_case' as GraphNodeType, filePath: fp, label: 'CreateOrderUseCase', metadata: {} },
          { id: orderDomain, type: 'arch_domain' as GraphNodeType, filePath: fp, label: 'Order', metadata: {} },
          { id: orderRepoInterface, type: 'arch_repository_interface' as GraphNodeType, filePath: fp, label: 'OrderRepositoryInterface', metadata: {} },
          { id: orderRepository, type: 'arch_repository' as GraphNodeType, filePath: fp, label: 'OrderRepository', metadata: {} },
          { id: orderDiContainer, type: 'arch_di_container' as GraphNodeType, filePath: fp, label: 'DI Container (Order)', metadata: {} },
        ],
        newEdges: [
          // Entry → modules
          { id: edgeId(ctx.sourceNode.id, userMod), from: ctx.sourceNode.id, to: userMod, type: 'arch_dependency' },
          { id: edgeId(ctx.sourceNode.id, orderMod), from: ctx.sourceNode.id, to: orderMod, type: 'arch_dependency' },

          // User module: Module → Presentation → Controller; Domain → UseCase; DI → RepoInterface & Repository; RepoInterface & Repository → UseCase; Controller → Repository & UseCase
          { id: edgeId(userMod, userPresentation), from: userMod, to: userPresentation, type: 'arch_dependency' },
          { id: edgeId(userPresentation, userController), from: userPresentation, to: userController, type: 'arch_dependency' },
          { id: edgeId(userDomain, userUseCase), from: userDomain, to: userUseCase, type: 'arch_dependency' },
          { id: edgeId(userDiContainer, userRepoInterface), from: userDiContainer, to: userRepoInterface, type: 'arch_dependency' },
          { id: edgeId(userDiContainer, userRepository), from: userDiContainer, to: userRepository, type: 'arch_dependency' },
          { id: edgeId(userRepository, userUseCase), from: userRepository, to: userUseCase, type: 'arch_dependency' },
          { id: edgeId(userRepoInterface, userUseCase), from: userRepoInterface, to: userUseCase, type: 'arch_dependency' },
          { id: edgeId(userController, userRepository), from: userController, to: userRepository, type: 'arch_dependency' },
          { id: edgeId(userController, userUseCase), from: userController, to: userUseCase, type: 'arch_dependency' },

          // Order module: same Clean Architecture structure
          { id: edgeId(orderMod, orderPresentation), from: orderMod, to: orderPresentation, type: 'arch_dependency' },
          { id: edgeId(orderPresentation, orderController), from: orderPresentation, to: orderController, type: 'arch_dependency' },
          { id: edgeId(orderDomain, orderUseCase), from: orderDomain, to: orderUseCase, type: 'arch_dependency' },
          { id: edgeId(orderDiContainer, orderRepoInterface), from: orderDiContainer, to: orderRepoInterface, type: 'arch_dependency' },
          { id: edgeId(orderDiContainer, orderRepository), from: orderDiContainer, to: orderRepository, type: 'arch_dependency' },
          { id: edgeId(orderRepository, orderUseCase), from: orderRepository, to: orderUseCase, type: 'arch_dependency' },
          { id: edgeId(orderRepoInterface, orderUseCase), from: orderRepoInterface, to: orderUseCase, type: 'arch_dependency' },
          { id: edgeId(orderController, orderRepository), from: orderController, to: orderRepository, type: 'arch_dependency' },
          { id: edgeId(orderController, orderUseCase), from: orderController, to: orderUseCase, type: 'arch_dependency' },
        ],
      };
    },
  },
  {
    name: 'arch-template-layered',
    displayName: 'Layered Architecture',
    description: 'Classic 3-tier: Presentation, Business, Data with User example.',
    build: (ctx) => {
      const { nodeId, edgeId } = createIdGenerators();
      const fp = ctx.sourceNode.filePath ?? '';
      const presentation = nodeId('arch_layer', 'Presentation');
      const business = nodeId('arch_layer', 'Business');
      const data = nodeId('arch_layer', 'Data');
      const userController = nodeId('arch_controller', 'UserController');
      const userService = nodeId('arch_service', 'UserService');
      const userRepo = nodeId('arch_repository', 'UserRepository');
      const userModel = nodeId('arch_model', 'User');
      return {
        newNodes: [
          { id: presentation, type: 'arch_layer' as GraphNodeType, filePath: fp, label: 'Presentation', metadata: {} },
          { id: business, type: 'arch_layer' as GraphNodeType, filePath: fp, label: 'Business', metadata: {} },
          { id: data, type: 'arch_layer' as GraphNodeType, filePath: fp, label: 'Data', metadata: {} },
          { id: userController, type: 'arch_controller' as GraphNodeType, filePath: fp, label: 'UserController', metadata: {} },
          { id: userService, type: 'arch_service' as GraphNodeType, filePath: fp, label: 'UserService', metadata: {} },
          { id: userRepo, type: 'arch_repository' as GraphNodeType, filePath: fp, label: 'UserRepository', metadata: {} },
          { id: userModel, type: 'arch_model' as GraphNodeType, filePath: fp, label: 'User', metadata: {} },
        ],
        newEdges: [
          { id: edgeId(ctx.sourceNode.id, presentation), from: ctx.sourceNode.id, to: presentation, type: 'arch_dependency' },
          { id: edgeId(presentation, business), from: presentation, to: business, type: 'arch_dependency' },
          { id: edgeId(business, data), from: business, to: data, type: 'arch_dependency' },
          { id: edgeId(presentation, userController), from: presentation, to: userController, type: 'arch_dependency' },
          { id: edgeId(business, userService), from: business, to: userService, type: 'arch_dependency' },
          { id: edgeId(data, userRepo), from: data, to: userRepo, type: 'arch_dependency' },
          { id: edgeId(data, userModel), from: data, to: userModel, type: 'arch_dependency' },
          { id: edgeId(userController, userService), from: userController, to: userService, type: 'arch_dependency' },
          { id: edgeId(userService, userRepo), from: userService, to: userRepo, type: 'arch_dependency' },
          { id: edgeId(userRepo, userModel), from: userRepo, to: userModel, type: 'arch_dependency' },
        ],
      };
    },
  },
];

function createTemplateBlueprint(t: (typeof TEMPLATES)[0]): Blueprint {
  return {
    name: t.name,
    displayName: t.displayName,
    description: t.description,
    category: 'Templates',
    supportedNodeTypes: ['arch_entry'],
    params: [],
    async validate(): Promise<ValidationResult> {
      return { valid: true, errors: [], warnings: [], conflicts: [] };
    },
    async generate(ctx: ForgeContext): Promise<{ mutations: FileMutation[]; graphMutations: GraphMutation }> {
      const { newNodes, newEdges } = t.build(ctx);
      return {
        mutations: [],
        graphMutations: { newNodes, newEdges },
      };
    },
  };
}

export const ARCH_TEMPLATE_BLUEPRINTS: Blueprint[] = TEMPLATES.map(createTemplateBlueprint);
