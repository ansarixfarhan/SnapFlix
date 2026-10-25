import { PropsWithChildren } from "react";
import { tv } from "tailwind-variants";

export type ColorType = "warning" | "primary" | "secondary" | "success" | "danger";

export const colors = tv({
  variants: {
    color: {
      warning: "bg-primary",
      primary: "bg-primary",
      secondary: "bg-secondary",
      success: "bg-success",
      danger: "bg-danger",
    },
  },
  defaultVariants: {
    color: "primary",
  },
});

export type HandlerType = {
  opened: boolean;
  onClose: () => void;
};

export type InputWrapperProps = {
  /** Contents of `Input.Label` component. If not set, label is not displayed. */
  label?: React.ReactNode;
  /** Contents of `Input.Description` component. If not set, description is not displayed. */
  description?: React.ReactNode;
  /** Contents of `Input.Error` component. If not set, error is not displayed. */
  error?: React.ReactNode;
  /** Adds required attribute to the input and a red asterisk on the right side of label @default `false` */
  required?: boolean;
};

export type DropdownItemProps = {
  label: string;
  href?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  color?: ColorType;
  className?: string;
  showDivider?: boolean;
  isReadOnly?: boolean;
  description?: string;
};

export type OverlayProps = PropsWithChildren & {
  isOpen: boolean;
  onClose: () => void;
  isLoading?: boolean;
};
