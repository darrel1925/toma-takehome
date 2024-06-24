export class User {
  // Name
  public first_name: string;
  public last_name: string;

  // Car
  public make: string;
  public model: string;
  public year: number;

  constructor() {
    this.first_name = "";
    this.last_name = "";
    this.make = "";
    this.model = "";
    this.year = 0;
  }
}
