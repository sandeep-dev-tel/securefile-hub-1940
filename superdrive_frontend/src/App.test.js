import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders SuperDrive brand", () => {
  render(<App />);
  const brand = screen.getByText(/SuperDrive/i);
  expect(brand).toBeInTheDocument();
});
