declare module "effront/application-entry" {
  const application: import("./application/definition").ApplicationDefinition<unknown, unknown>;

  export default application;
}
