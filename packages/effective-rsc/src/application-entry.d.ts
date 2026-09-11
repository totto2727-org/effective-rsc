declare module "effective-rsc/application-entry" {
  const application: import("./application/definition").ApplicationDefinition<unknown, unknown>;

  export default application;
}
