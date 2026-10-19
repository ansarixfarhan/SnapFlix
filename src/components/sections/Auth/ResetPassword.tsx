import { resetPassword } from "@/actions/auth";
import PasswordInput from "@/components/ui/input/PasswordInput";
import { ResetPasswordFormSchema } from "@/schemas/auth";
import { LockPassword } from "@/utils/icons";
import { useRouter } from "@bprogress/next/app";
import { addToast, Button } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

const AuthResetPasswordForm: React.FC = () => {
  const router = useRouter();

  const {
    watch,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(ResetPasswordFormSchema),
    mode: "onChange",
    defaultValues: {
      password: "",
      confirm: "",
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    const { success, message } = await resetPassword(data);

    addToast({
      title: message,
      color: success ? "success" : "danger",
    });

    if (!success) {
      return;
    }

    return router.push("/");
  });

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <p className="text-small text-foreground-500 mb-4 text-center">
        Please enter your new password to continue your streaming journey
      </p>
      <PasswordInput
        {...register("password")}
        value={watch("password")}
        isInvalid={!!errors.password?.message}
        errorMessage={errors.password?.message}
        isRequired
        variant="underlined"
        label="New Password"
        placeholder="Enter your new password"
        startContent={<LockPassword className="text-xl" />}
        isDisabled={isSubmitting}
      />
      <PasswordInput
        {...register("confirm")}
        isInvalid={!!errors.confirm?.message}
        errorMessage={errors.confirm?.message}
        isRequired
        variant="underlined"
        label="Confirm Password"
        placeholder="Confirm your new password"
        startContent={<LockPassword className="text-xl" />}
        isDisabled={isSubmitting}
      />
      <Button
        className="mt-3 w-full"
        color="primary"
        type="submit"
        variant="shadow"
        isLoading={isSubmitting}
      >
        {isSubmitting ? "Resetting Password..." : "Reset Password"}
      </Button>
    </form>
  );
};

export default AuthResetPasswordForm;
